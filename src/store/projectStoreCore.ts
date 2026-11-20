import { ProjectData } from '../types';
import { generateGcode } from '../lib/gcode/generator';
import { analyzeProjectWarnings } from '../lib/utils/warnings';
import { LOCAL_STORAGE_KEY } from './initialState';
import { HistoryState, ProjectStore, StoreSet } from './projectStore.types';

export interface StoreCore {
  pushHistory: () => void;
  pushHistoryCoalesced: (key: string) => void;
  resetHistoryCoalescing: () => void;
  syncAndSave: (stateUpdate: Partial<ProjectStore>) => void;
  flushAutosave: () => void;
}

// Максимальная глубина истории undo/redo (общая для записи снапшотов и их сдвига).
export const HISTORY_LIMIT = 20;

// Задержка отложенного автосохранения в localStorage (мс). Убирает синхронную
// сериализацию JSON на каждом нажатии клавиши и тике перетаскивания.
export const AUTOSAVE_DEBOUNCE_MS = 300;

// Общие хелперы стора (история с коалесценцией + атомарная синхронизация G-кода +
// отложенный автосейв). Создаются ОДИН раз внутри create() и пробрасываются всем срезам.
export function makeStoreCore(set: StoreSet, get: () => ProjectStore): StoreCore {
  // Слияние (коалесценция) шагов истории для непрерывного ввода: набор символов
  // в PropertyInput (onchange на каждое нажатие), клики степпера, поля настроек
  // станка — это ОДНО действие пользователя, а не десяток.
  const HISTORY_COALESCE_MS = 900;
  let lastCoalesceKey: string | null = null;
  let lastCoalesceAt = 0;

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let autosavePending = false;

  const persistToLocalStorage = () => {
    autosavePending = false;
    try {
      const cur = get();
      const exportData: ProjectData = {
        version: '1.0',
        name: cur.projectName,
        machine: cur.machine,
        objects: cur.objects,
        operations: [],
        postprocessorTemplates: cur.templates,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(exportData));
    } catch {
      // ignore storage quota / private mode errors
    }
  };

  const flushAutosave = () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    if (autosavePending) {
      persistToLocalStorage();
    }
  };

  const scheduleAutosave = () => {
    autosavePending = true;
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      persistToLocalStorage();
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  // Гарантируем сохранение отложенного снимка при закрытии/обновлении вкладки.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', flushAutosave);
  }

  // Запись шага истории: сохраняем состояние ДО мутации.
  const pushHistory = () => {
    lastCoalesceKey = null;
    const cur = get();
    const snapshot: HistoryState = {
      objects: structuredClone(cur.objects),
      machine: structuredClone(cur.machine),
    };
    set({
      historyUndo: [...cur.historyUndo.slice(-(HISTORY_LIMIT - 1)), snapshot],
      historyRedo: [],
    });
  };

  const pushHistoryCoalesced = (key: string) => {
    const now = Date.now();
    if (key !== lastCoalesceKey || now - lastCoalesceAt > HISTORY_COALESCE_MS) {
      pushHistory();
    }
    lastCoalesceKey = key;
    lastCoalesceAt = now;
  };

  const resetHistoryCoalescing = () => {
    lastCoalesceKey = null;
  };

  // Атомарно применяет обновление состояния вместе с пересчитанными G-кодом,
  // сегментами траектории и предупреждениями за ОДИН вызов set(), затем
  // планирует отложенное сохранение в localStorage.
  const syncAndSave = (stateUpdate: Partial<ProjectStore>) => {
    const cur = get();
    const nextObjects = stateUpdate.objects ?? cur.objects;
    const nextMachine = stateUpdate.machine ?? cur.machine;
    const nextTemplates = stateUpdate.templates ?? cur.templates;
    const nextManualDirty = stateUpdate.manualGcodeDirty ?? cur.manualGcodeDirty;

    const genRes = generateGcode(nextObjects, [], nextMachine, nextTemplates);
    const warnList = analyzeProjectWarnings(nextObjects, [], nextMachine);

    // Если пользователь вручную правил G-код (manualGcodeDirty), не перезатираем
    // его текст при правках 2D-фигур; явный regenerate/parse/load сбрасывает флаг.
    set({
      ...stateUpdate,
      generatedGcode: genRes.gcode,
      ...(nextManualDirty ? {} : { manualGcode: genRes.gcode }),
      toolpathSegments: genRes.segments,
      warnings: warnList,
    });

    scheduleAutosave();
  };

  return {
    pushHistory,
    pushHistoryCoalesced,
    resetHistoryCoalescing,
    syncAndSave,
    flushAutosave,
  };
}

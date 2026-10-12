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
}

// Максимальная глубина истории undo/redo (общая для записи снапшотов и их сдвига).
export const HISTORY_LIMIT = 20;

// Общие хелперы стора (история с коалесценцией + синхронизация генерации/автосейва).
// Создаются ОДИН раз внутри create() и пробрасываются всем срезам через StoreCtx,
// сохраняя прежнюю семантику замыкания над set/get и изменяемыми переменными коалесценции.
export function makeStoreCore(set: StoreSet, get: () => ProjectStore): StoreCore {
  // Слияние (коалесценция) шагов истории для непрерывного ввода: набор символов
  // в PropertyInput (onchange на каждое нажатие), клики степпера, поля настроек
  // станка — это ОДНО действие пользователя, а не десяток. Без слияния каждое
  // нажатие клавиши толкало snapshot + полную генерацию G-кода, и undo откатывал
  // по одной цифре. Ключ = цель+поля; если он совпадает с предыдущим и прошло
  // меньше HISTORY_COALESCE_MS — новый шаг не создаётся (первый keystroke уже
  // записал состояние ДО начала набора).
  const HISTORY_COALESCE_MS = 900;
  let lastCoalesceKey: string | null = null;
  let lastCoalesceAt = 0;

  // Helper to record history step. Snapshots the current (pre-change) state so that
  // an undo restores what was there before the action. Call BEFORE mutating state.
  const pushHistory = () => {
    // Дискретная запись истории заканчивает предыдущую «сессию непрерывного ввода»:
    // следующее коалесцируемое изменение обязано создать новый шаг.
    lastCoalesceKey = null;
    const cur = get();
    const snapshot: HistoryState = {
      objects: structuredClone(cur.objects),
      operations: structuredClone(cur.operations),
      machine: structuredClone(cur.machine),
    };
    set({
      // keep at most HISTORY_LIMIT states (slice off (LIMIT-1) then append one)
      historyUndo: [...cur.historyUndo.slice(-(HISTORY_LIMIT - 1)), snapshot],
      historyRedo: [],
    });
  };

  const pushHistoryCoalesced = (key: string) => {
    const now = Date.now();
    if (key !== lastCoalesceKey || now - lastCoalesceAt > HISTORY_COALESCE_MS) {
      pushHistory(); // сбрасывает lastCoalesceKey внутри себя
    }
    lastCoalesceKey = key;
    lastCoalesceAt = now;
  };

  // Явный сброс «сессии непрерывного ввода» (после undo/redo следующая правка всегда
  // пишет новый шаг). Ранее undo/redo писали lastCoalesceKey напрямую из замыкания create.
  const resetHistoryCoalescing = () => {
    lastCoalesceKey = null;
  };

  // Helper to sync generation & warnings & local storage
  const syncAndSave = (stateUpdate: Partial<ProjectStore>) => {
    set(stateUpdate);
    const { objects, operations, machine, templates } = get();

    const genRes = generateGcode(objects, operations, machine, templates);
    const warnList = analyzeProjectWarnings(objects, operations, machine);

    // Respect manual edits: once the user hand-types G-code (manualGcodeDirty), stop
    // clobbering it with regenerated output. An explicit regenerate/parse/load clears the
    // flag and re-syncs. generatedGcode/segments/warnings always refresh.
    const manualDirty = get().manualGcodeDirty;
    set({
      generatedGcode: genRes.gcode,
      ...(manualDirty ? {} : { manualGcode: genRes.gcode }),
      toolpathSegments: genRes.segments,
      warnings: warnList,
    });

    // Save to local storage
    try {
      const exportData: ProjectData = {
        version: '1.0',
        name: get().projectName,
        machine: get().machine,
        objects: get().objects,
        operations: get().operations,
        postprocessorTemplates: get().templates,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(exportData));
    } catch {
      // ignore
    }
  };

  return { pushHistory, pushHistoryCoalesced, resetHistoryCoalescing, syncAndSave };
}

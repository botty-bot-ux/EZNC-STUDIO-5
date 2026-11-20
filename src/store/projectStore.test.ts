import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLastSelectedId, useProjectStore } from './useProjectStore';
import { isRailMachine, LOCAL_STORAGE_KEY } from './initialState';
import { AUTOSAVE_DEBOUNCE_MS } from './projectStoreCore';
import { createObjectId } from '../lib/utils/id';

describe('useProjectStore — критические сценарии стора', () => {
  beforeEach(() => {
    const s = useProjectStore.getState();
    s.newProject('head');
    useProjectStore.setState({ historyUndo: [], historyRedo: [], toast: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('applyMachinePreset переключает пресет, синхронизирует инструмент arc ↔ point и откатывается по undo', () => {
    const store = useProjectStore;
    store.getState().setActiveTool('arc');
    expect(isRailMachine(store.getState().machine)).toBe(false);

    store.getState().applyMachinePreset('rail');
    expect(isRailMachine(store.getState().machine)).toBe(true);
    expect(store.getState().machine.toolDiameter).toBe(8);
    expect(store.getState().activeTool).toBe('point');
    expect(store.getState().historyUndo).toHaveLength(1);

    // Обратное переключение на Изголовье возвращает arc вместо point
    store.getState().applyMachinePreset('head');
    expect(isRailMachine(store.getState().machine)).toBe(false);
    expect(store.getState().machine.toolDiameter).toBe(3);
    expect(store.getState().activeTool).toBe('arc');

    // Undo возвращает состояние станка пресета Царга
    store.getState().undo();
    expect(store.getState().machine.toolDiameter).toBe(8);
  });

  it('parseManualGcode применяет правки на холст и сбрасывает manualGcodeDirty, восстанавливая автосинхронизацию', () => {
    const store = useProjectStore;
    store.getState().addObject({
      id: 'line_1',
      name: 'Отрезок 1',
      type: 'line',
      startX: -100,
      startY: -100,
      endX: -200,
      endY: -100,
      depth: 17.5,
      operationType: 'cut',
    });

    // Пользователь вручную правит координату в редакторе G-кода
    const edited = store.getState().manualGcode.replace('X-200', 'X-350');
    store.getState().updateManualGcode(edited);
    expect(store.getState().manualGcodeDirty).toBe(true);

    // «Применить на холст» должно обновить объект и сбросить manualGcodeDirty
    store.getState().parseManualGcode();
    expect(store.getState().manualGcodeDirty).toBe(false);
    const updatedLine = store.getState().objects.find((o) => o.id === 'line_1');
    expect(updatedLine?.type).toBe('line');
    if (updatedLine?.type === 'line') {
      expect(updatedLine.endX).toBeCloseTo(-350, 2);
    }

    // Последующая правка в 2D снова автоматически обновляет manualGcode
    store.getState().updateObject('line_1', { endY: -250 });
    expect(store.getState().manualGcode).toContain('Y-250');
  });

  it('undo / redo корректно восстанавливают геометрию и сбрасывают redo при новой правке', () => {
    const store = useProjectStore;
    store.getState().addObject({
      id: 'r1',
      name: 'Прямоугольник',
      type: 'rectangle',
      x: -200,
      y: -300,
      width: 100,
      height: 150,
      depth: 17.5,
      operationType: 'cut',
    });
    expect(store.getState().objects).toHaveLength(1);

    const res = store.getState().filletRectangle('r1', 15);
    expect(res.ok).toBe(true);
    const afterFillet = store.getState().objects[0];
    expect(afterFillet.type === 'rectangle' && afterFillet.cornerRadius).toBe(15);

    store.getState().undo();
    const afterUndo = store.getState().objects[0];
    expect(afterUndo.type === 'rectangle' && (afterUndo.cornerRadius ?? 0)).toBe(0);
    expect(store.getState().historyRedo).toHaveLength(1);

    store.getState().redo();
    const afterRedo = store.getState().objects[0];
    expect(afterRedo.type === 'rectangle' && afterRedo.cornerRadius).toBe(15);

    // Новая дискретная правка очищает redo-стек
    store.getState().undo();
    store.getState().moveSelectedObjectsBy(-10, -20);
    expect(store.getState().historyRedo).toHaveLength(0);
  });

  it('getLastSelectedId отражает порядок выделения, а не порядок массива objects', () => {
    const store = useProjectStore;
    store.getState().addObject({
      id: 'first',
      name: 'Первый',
      type: 'line',
      startX: -10,
      startY: -10,
      endX: -50,
      endY: -10,
      depth: 5,
      operationType: 'cut',
    });
    store.getState().addObject({
      id: 'second',
      name: 'Второй',
      type: 'line',
      startX: -10,
      startY: -30,
      endX: -50,
      endY: -30,
      depth: 5,
      operationType: 'cut',
    });

    // Выбираем сначала второй, затем добавляем первый → основной должен быть 'first'
    store.getState().setSelectedObjectIds(['second', 'first']);
    expect(getLastSelectedId(store.getState().selectedObjectIds)).toBe('first');
  });

  it('syncAndSave обновляет объекты и G-код атомарно за один set() без двойного ререндера', () => {
    const store = useProjectStore;
    store.getState().addObject({
      id: 'atomic_line',
      name: 'Линия',
      type: 'line',
      startX: -10,
      startY: -10,
      endX: -100,
      endY: -10,
      depth: 10,
      operationType: 'cut',
    });

    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    // saveHistory=false изолирует вызов syncAndSave (без pushHistory)
    store.getState().updateObject('atomic_line', { endX: -250 }, false);
    unsubscribe();

    expect(notifications).toBe(1);
    expect(store.getState().generatedGcode).toContain('X-250');
  });

  it('автосохранение в localStorage объединяет частые правки через debounce', () => {
    vi.useFakeTimers();
    const storeMap = new Map<string, string>();
    const setItemSpy = vi.fn((k: string, v: string) => {
      storeMap.set(k, v);
    });
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storeMap.get(k) ?? null,
      setItem: setItemSpy,
      removeItem: (k: string) => storeMap.delete(k),
      clear: () => storeMap.clear(),
      key: () => null,
      length: 0,
    });

    const store = useProjectStore;
    store.getState().addObject({
      id: 'deb_line',
      name: 'Линия',
      type: 'line',
      startX: -10,
      startY: -10,
      endX: -50,
      endY: -10,
      depth: 10,
      operationType: 'cut',
    });
    store.getState().updateObject('deb_line', { endX: -60 }, false);
    store.getState().updateObject('deb_line', { endX: -70 }, false);

    // До истечения таймера записи в localStorage ещё нет
    expect(setItemSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS + 10);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy.mock.calls[0][0]).toBe(LOCAL_STORAGE_KEY);
    expect(storeMap.get(LOCAL_STORAGE_KEY)).toContain('-70');

    vi.unstubAllGlobals();
  });

  it('обратная совместимость: loadProjectJSON открывает старый JSON с полем operations и экспортирует валидный ProjectData', () => {
    const store = useProjectStore;
    const legacyJson = JSON.stringify({
      version: '1.0',
      name: 'Старый_Проект',
      machine: store.getState().machine,
      objects: [
        {
          id: 'legacy_c1',
          name: 'Круг',
          type: 'circle',
          centerX: -150,
          centerY: -150,
          radius: 40,
          depth: 16,
          operationType: 'cut',
        },
      ],
      operations: [{ id: 'op_1', name: 'Старая операция', enabled: true, type: 'cutContour', linkedObjectIds: ['legacy_c1'] }],
    });

    expect(store.getState().loadProjectJSON(legacyJson)).toBe(true);
    expect(store.getState().projectName).toBe('Старый_Проект');
    expect(store.getState().objects).toHaveLength(1);

    const exported = JSON.parse(store.getState().exportProjectJSON());
    expect(exported.objects).toHaveLength(1);
    expect(exported.operations).toEqual([]);
  });

  it('createObjectId гарантирует уникальность в пакетных операциях и showToast автоматически скрывается', () => {
    vi.useFakeTimers();
    const ids = new Set(Array.from({ length: 100 }, () => createObjectId('bulk')));
    expect(ids.size).toBe(100);

    const store = useProjectStore;
    store.getState().showToast('Сохранено');
    expect(store.getState().toast?.text).toBe('Сохранено');
    expect(store.getState().toast?.isError).toBe(false);

    vi.advanceTimersByTime(3600);
    expect(store.getState().toast).toBeNull();
  });

  it('openSafetyDrawer и setActiveTab раскрывают свёрнутый инспектор, а сворачивание закрывает шторку безопасности', () => {
    const store = useProjectStore;
    store.setState({ rightPanelOpen: false, panelDismissed: true, safetyDrawerOpen: false });

    store.getState().openSafetyDrawer();
    expect(store.getState().rightPanelOpen).toBe(true);
    expect(store.getState().panelDismissed).toBe(false);
    expect(store.getState().safetyDrawerOpen).toBe(true);

    // Сворачивание инспектора закрывает шторку безопасности
    store.getState().toggleRightPanel();
    expect(store.getState().rightPanelOpen).toBe(false);
    expect(store.getState().safetyDrawerOpen).toBe(false);

    // Явный переход на вкладку «Станок» также раскрывает правую панель
    store.getState().setActiveTab('machine');
    expect(store.getState().rightPanelOpen).toBe(true);
    expect(store.getState().activeTab).toBe('machine');
  });

  it('newProject применяет пользовательские границы станка и размер листа ДСП и поддерживает откат', () => {
    const store = useProjectStore;
    store.getState().newProject('head', {
      bounds: { xMin: -1200, xMax: 0, yMin: -2400, yMax: 0, zMin: -40, zMax: 80 },
      stockSheet: { enabled: true, preset: 'custom', widthY: 1881, widthX: 1121 },
    });

    const m = store.getState().machine;
    expect(m.toolDiameter).toBe(3);
    expect(m.bounds).toEqual({ xMin: -1200, xMax: 0, yMin: -2400, yMax: 0, zMin: -40, zMax: 80 });
    expect(m.stockSheet?.enabled).toBe(true);
    expect(m.stockSheet?.widthY).toBe(1881);
    expect(m.stockSheet?.widthX).toBe(1121);

    // Откат возвращает предыдущие границы станка
    store.getState().undo();
    expect(store.getState().machine.bounds.xMin).toBe(-1600);
  });
});

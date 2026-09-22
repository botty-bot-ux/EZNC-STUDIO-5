import { create } from 'zustand';
import {
  ActiveTab,
  ActiveTool,
  ArcMode,
  CADObject,
  LineMode,
  LiveScaleState,
  MachineSettings,
  MobileSheet,
  NewCADObjectInput,
  OperationItem,
  ParallelPreviewState,
  Point2D,
  PostprocessorTemplates,
  ProjectData,
  ToolpathSegment,
  UnderlayState,
  ViewMode,
  WarningItem,
} from '../types';
import { generateGcode } from '../lib/gcode/generator';
import { extractProjectDataFromNC, parseGcodeToCadObjects, parseGcodeToSegments } from '../lib/gcode/parser';
import { OBJECT_MARKER_LINE_RE } from '../lib/gcode/constants';
import { DEFAULT_TEMPLATES } from '../lib/postprocessor/templates';
import { analyzeProjectWarnings } from '../lib/utils/warnings';
import { optimizeCADObjects, OptimizationResult } from '../lib/geometry/optimizer';
import { scaleCADObject, translateCADObject } from '../lib/geometry/transform';
import {
  INITIAL_MACHINE,
  INITIAL_OBJECTS,
  INITIAL_OPERATIONS,
  LOCAL_STORAGE_KEY,
  DEFAULT_UNDERLAY,
  PROJECT_MODE_PRESETS,
  ProjectMode,
} from './initialState';

interface HistoryState {
  objects: CADObject[];
  operations: OperationItem[];
  machine: MachineSettings;
}

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'cnc_theme';

// Тема — вне проекта (не попадает в экспорт/автосейв). Читаем сохранённую, иначе — системную.
function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === 'dark' || t === 'light') return t;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // ignore
  }
  return 'light';
}

function applyThemeClass(theme: Theme) {
  try {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {
    // ignore
  }
}

interface ProjectStore {
  projectName: string;
  machine: MachineSettings;
  objects: CADObject[];
  operations: OperationItem[];
  templates: PostprocessorTemplates;

  // selectedObjectIds — ЕДИНСТВЕННЫЙ источник истины о выделении; «основная»
  // фигура (для панели свойств и грифов) = последний id. Доступна через хук
  // useSelectedObjectId() в конце файла. Раньше дублировалась полем
  // selectedObjectId, которое расходилось с массивом при загрузке проектов.
  selectedObjectIds: string[];
  selectedOperationId: string | null;
  // Модалки действий с фигурами («Переместить», «Масштабировать», «Параллельная …»)
  // живут на уровне App (ShapeActionsHost) и открываются по запросу — из панели
  // Свойств и из правого-кликового меню на холсте.
  shapeDialog: { kind: 'move' | 'scale' | 'parallel' } | null;
  setShapeDialog: (d: { kind: 'move' | 'scale' | 'parallel' } | null) => void;
  // Transient interaction state surfaced to the Свойства panel during a drag / measure.
  // Kept out of `objects` so it never triggers history, autosave or G-code regen.
  liveEdit: { id: string; patch: Partial<CADObject> } | null;
  liveMeasure: { start: Point2D; end: Point2D } | null;
  // Живое превью перемещения группы (модуль «Переместить»): смещение выбранных фигур на
  // холсте до подтверждения. Только отрисовка — не трогает objects/историю/G-код.
  liveMove: { ids: string[]; dx: number; dy: number } | null;
  // Живое превью модуля «Масштабировать»: растяжение выбранных фигур относительно
  // якоря до подтверждения. Только отрисовка — не трогает objects/историю/G-код.
  liveScale: LiveScaleState | null;
  // Живое превью модуля «Параллельная линия»: штриховые копии будущих линий на холсте
  // до подтверждения. Только отрисовка — не трогает objects/историю/G-код.
  parallelPreview: ParallelPreviewState | null;
  // Session-only background reference image («подложка»). Never persisted, never affects G-code.
  underlay: UnderlayState;
  activeTool: ActiveTool;
  // Под-режим построения дуги (используется, когда activeTool === 'arc').
  arcMode: ArcMode;
  // Под-режим построения линии (используется, когда activeTool === 'line').
  lineMode: LineMode;
  // Идёт жест на холсте (перетаскивание фигуры/грифа или рисование с уже поставленной
  // первой точкой). Пока true — плавающие боковые панели игнорируют мышь
  // (pointer-events:none), чтобы не перехватывать события у холста.
  canvasGrabbing: boolean;
  activeTab: ActiveTab;
  viewMode: ViewMode;

  theme: Theme;

  snapToGrid: boolean;
  gridStep: number;

  generatedGcode: string;
  manualGcode: string;
  // True once the user hand-edits G-code in the editor; normal object edits then
  // stop overwriting `manualGcode` until an explicit regenerate/parse/load happens.
  manualGcodeDirty: boolean;
  toolpathSegments: ToolpathSegment[];
  warnings: WarningItem[];

  // Транзиентный буфер группового копирования (Ctrl+C / Ctrl+V). Копии фигур вместе с
  // их взаимным расположением; seq увеличивает смещение при повторных вставках.
  // Не входит в историю и не сохраняется в localStorage / экспорт проекта.
  clipboard: CADObject[];
  clipboardSeq: number;

  historyUndo: HistoryState[];
  historyRedo: HistoryState[];

  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  // Пользователь свернул правую панель РУКОЙ: с этого момента авто-открытие
  // (выбор фигуры, линейка) молчит, пока он сам не нажмёт кнопку панели.
  panelDismissed: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Мобильная шторка (сессонное состояние, не сохраняется).
  mobileSheet: MobileSheet;
  setMobileSheet: (sheet: MobileSheet) => void;

  // Actions
  setProjectName: (name: string) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setArcMode: (mode: ArcMode) => void;
  setLineMode: (mode: LineMode) => void;
  setCanvasGrabbing: (grabbing: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridStep: (step: number) => void;
  setSelectedObjectId: (id: string | null) => void;
  setSelectedObjectIds: (ids: string[]) => void;
  toggleObjectSelection: (id: string) => void;
  selectAllObjects: () => void;
  setSelectedOperationId: (id: string | null) => void;
  setLiveEdit: (v: { id: string; patch: Partial<CADObject> } | null) => void;
  setLiveMeasure: (v: { start: Point2D; end: Point2D } | null) => void;
  setLiveMove: (v: { ids: string[]; dx: number; dy: number } | null) => void;
  setLiveScale: (v: LiveScaleState | null) => void;
  setParallelPreview: (v: ParallelPreviewState | null) => void;

  // Подложка (фоновая референсная картинка) — только на сессию.
  setUnderlayImage: (src: string) => void;
  updateUnderlay: (partial: Partial<UnderlayState>) => void;
  fitUnderlayToSheet: () => void;
  clearUnderlay: () => void;

  updateMachine: (partial: Partial<MachineSettings>) => void;

  reorderObjects: (newObjects: CADObject[]) => void;
  optimizeRoute: () => OptimizationResult | null;
  addObject: (obj: NewCADObjectInput) => void;
  updateObject: (id: string, partial: Partial<CADObject>, saveHistory?: boolean) => void;
  updateSelectedObjects: (partial: Partial<CADObject>, saveHistory?: boolean) => void;
  updateObjectsBulk: (updates: Array<{ id: string; patch: Partial<CADObject> }>, saveHistory?: boolean) => void;
  recordHistory: () => void;
  deleteObject: (id: string) => void;
  deleteSelectedObjects: () => void;
  duplicateObject: (id: string) => void;

  // Групповое копирование выделенных фигур (Ctrl+C) и вставка копии (Ctrl+V).
  copySelectedObjects: () => void;
  pasteClipboard: () => void;
  // Точное перемещение выделения на относительный сдвиг (dx, dy) в мм.
  moveSelectedObjectsBy: (dx: number, dy: number) => void;
  // Точное растяжение (масштабирование) выделения относительно якоря с множителями sx/sy.
  scaleSelectedObjectsBy: (anchor: Point2D, sx: number, sy: number) => void;

  addOperation: (op: OperationItem) => void;
  updateOperation: (id: string, partial: Partial<OperationItem>) => void;
  deleteOperation: (id: string) => void;
  reorderOperations: (newOps: OperationItem[]) => void;
  toggleOperationEnabled: (id: string) => void;

  updateManualGcode: (code: string) => void;
  parseManualGcode: () => void;

  regenerateGcode: () => void;
  newProject: (mode: ProjectMode) => void;
  loadProjectJSON: (jsonStr: string) => boolean;
  loadProjectNC: (fileContent: string, fileName?: string) => boolean;
  exportProjectJSON: () => string;
  exportGcode: () => string;

  undo: () => void;
  redo: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  const HISTORY_LIMIT = 20;

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
  const pushHistoryCoalesced = (key: string) => {
    const now = Date.now();
    if (key !== lastCoalesceKey || now - lastCoalesceAt > HISTORY_COALESCE_MS) {
      pushHistory(); // сбрасывает lastCoalesceKey внутри себя
    }
    lastCoalesceKey = key;
    lastCoalesceAt = now;
  };

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

  // Load initial from local storage if available
  let initName = 'Проект_ЧПУ_Деталь_1';
  let initMachine = INITIAL_MACHINE;
  let initObjects = INITIAL_OBJECTS;
  let initOperations = INITIAL_OPERATIONS;
  let initTemplates = DEFAULT_TEMPLATES;

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ProjectData;
      if (parsed && parsed.objects && parsed.machine) {
        initName = parsed.name || initName;
        initMachine = { ...INITIAL_MACHINE, ...parsed.machine };
        // One-time refresh: a cached project that still carries the OLD default tool/feeds
        // (i.e. never customized) is upgraded to the new «Изголовье» defaults. Edited projects
        // keep their own values.
        const pm = parsed.machine as Partial<MachineSettings> | undefined;
        if (pm && pm.toolDiameter === 3.175 && pm.cutDepth === 5 && pm.feedCut === 1200) {
          initMachine = { ...INITIAL_MACHINE };
        }
        initObjects = parsed.objects;
        initOperations = parsed.operations || [];
        initTemplates = parsed.postprocessorTemplates || DEFAULT_TEMPLATES;

        // Automatically upgrade old default templates to new standard NC Studio 5 template
        if (
          !initTemplates.header ||
          !initTemplates.header.includes('G21') ||
          initTemplates.header.includes('%') ||
          initTemplates.header.includes('NC-Studio')
        ) {
          initTemplates = DEFAULT_TEMPLATES;
        }
      }
    }
  } catch {
    // fallback
  }

  const initialGen = generateGcode(initObjects, initOperations, initMachine, initTemplates);
  const initialWarns = analyzeProjectWarnings(initObjects, initOperations, initMachine);

  const initialTheme = readStoredTheme();
  applyThemeClass(initialTheme);

  return {
    projectName: initName,
    machine: initMachine,
    objects: initObjects,
    operations: initOperations,
    templates: initTemplates,

    selectedObjectIds: [],
    selectedOperationId: null,
    shapeDialog: null,
    liveEdit: null,
    liveMeasure: null,
    liveMove: null,
    liveScale: null,
    parallelPreview: null,
    underlay: DEFAULT_UNDERLAY,
    activeTool: 'select',
    arcMode: 'bulge',
    lineMode: 'line',
    canvasGrabbing: false,
    activeTab: 'gcode',
    viewMode: 'edit',

    theme: initialTheme,

    snapToGrid: true,
    gridStep: 1,

    generatedGcode: initialGen.gcode,
    manualGcode: initialGen.gcode,
    manualGcodeDirty: false,
    toolpathSegments: initialGen.segments,
    warnings: initialWarns,

    clipboard: [],
    clipboardSeq: 0,

    historyUndo: [],
    historyRedo: [],

    leftPanelOpen: true,
    rightPanelOpen: true,
    panelDismissed: false,
    toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
    toggleRightPanel: () =>
      set((state) => {
        const next = !state.rightPanelOpen;
        // Открыл сам — снова разрешаем авто-раскрытие; свернул сам — запрещаем.
        return { rightPanelOpen: next, panelDismissed: !next };
      }),

    mobileSheet: 'none',
    setMobileSheet: (sheet: MobileSheet) => set({ mobileSheet: sheet }),

    setProjectName: (name: string) => syncAndSave({ projectName: name }),

    setActiveTool: (tool: ActiveTool) =>
      set((state) => ({
        activeTool: tool,
        ...(tool === 'measure'
          ? {
              ...(state.panelDismissed
                ? {}
                : { activeTab: 'properties' as ActiveTab, mobileSheet: 'properties' as MobileSheet, rightPanelOpen: true }),
              viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode,
            }
          : {}),
      })),
    setArcMode: (mode: ArcMode) => set({ arcMode: mode }),
    setLineMode: (mode: LineMode) => set({ lineMode: mode }),
    setCanvasGrabbing: (grabbing: boolean) => set({ canvasGrabbing: grabbing }),
    setActiveTab: (tab: ActiveTab) =>
      set((state) => ({
        activeTab: tab,
        mobileSheet: tab,
        // Явный клик по вкладке = пользователь вернулся к панели — снимаем «свернуто рукой».
        rightPanelOpen: tab === 'properties' ? true : state.rightPanelOpen,
        panelDismissed: false,
        viewMode: tab === 'gcode' ? 'gcode' : state.viewMode === 'gcode' ? 'edit' : state.viewMode,
      })),
    setViewMode: (mode: ViewMode) =>
      set((state) => ({
        viewMode: mode,
        panelDismissed: false,
        activeTab: mode === 'gcode' ? 'gcode' : state.activeTab === 'gcode' ? 'machine' : state.activeTab,
        rightPanelOpen: mode === 'gcode' ? true : state.rightPanelOpen,
      })),
    setSnapToGrid: (snap: boolean) => set({ snapToGrid: snap }),
    setGridStep: (step: number) => set({ gridStep: step }),

    // Тема — отдельный локальный ключ, вне истории/автосейва проекта.
    setTheme: (theme: Theme) => {
      applyThemeClass(theme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // ignore
      }
      set({ theme });
    },
    toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

    setSelectedObjectId: (id: string | null) =>
      set((state) => ({
        selectedObjectIds: id ? [id] : [],
        ...(id
          ? {
              // Свернуто рукой → не раскрываем и не сбиваем вкладку;
              // из редактора G-кода всё равно выходим — выделение должно быть видно.
              ...(state.panelDismissed
                ? {}
                : { activeTab: 'properties' as ActiveTab, rightPanelOpen: true }),
              viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode,
            }
          : {}),
      })),

    setSelectedObjectIds: (ids: string[]) =>
      set((state) => ({
        selectedObjectIds: ids,
        ...(ids.length > 0
          ? {
              ...(state.panelDismissed
                ? {}
                : { activeTab: 'properties' as ActiveTab, rightPanelOpen: true }),
              viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode,
            }
          : {}),
      })),

    toggleObjectSelection: (id: string) => {
      const cur = get().selectedObjectIds;
      const exists = cur.includes(id);
      const newIds = exists ? cur.filter((i) => i !== id) : [...cur, id];
      set((state) => ({
        selectedObjectIds: newIds,
        ...(newIds.length > 0 && !state.panelDismissed
          ? { activeTab: 'properties' as ActiveTab, rightPanelOpen: true }
          : {}),
      }));
    },

    selectAllObjects: () => {
      const visibleIds = get().objects.filter((o) => o.visible !== false).map((o) => o.id);
      set({
        selectedObjectIds: visibleIds,
      });
    },

    setSelectedOperationId: (id: string | null) =>
      set({
        selectedOperationId: id,
      }),

    setLiveEdit: (v) => set({ liveEdit: v }),
    setLiveMeasure: (v) => set({ liveMeasure: v }),
    setLiveMove: (v) => set({ liveMove: v }),
    setLiveScale: (v) => set({ liveScale: v }),
    setParallelPreview: (v) => set({ parallelPreview: v }),
    setShapeDialog: (d) => set({ shapeDialog: d }),

    // Подложка — только на сессию: plain set, без истории/автосейва/генерации G-кода.
    setUnderlayImage: (src) => {
      const sheet = get().machine.stockSheet;
      const widthX = sheet?.widthX ?? 1081;
      const widthY = sheet?.widthY ?? 1681;
      const cur = get().underlay;
      set({
        underlay: {
          src,
          x: -widthX,
          y: -widthY,
          w: widthX,
          h: widthY,
          opacity: cur.opacity,
          visible: true,
          frozen: false,
        },
      });
    },
    updateUnderlay: (partial) => set({ underlay: { ...get().underlay, ...partial } }),
    fitUnderlayToSheet: () => {
      const sheet = get().machine.stockSheet;
      const widthX = sheet?.widthX ?? 1081;
      const widthY = sheet?.widthY ?? 1681;
      set({
        underlay: { ...get().underlay, x: -widthX, y: -widthY, w: widthX, h: widthY },
      });
    },
    clearUnderlay: () => set({ underlay: { ...DEFAULT_UNDERLAY } }),

    updateMachine: (partial: Partial<MachineSettings>) => {
      pushHistoryCoalesced(`machine:${Object.keys(partial).sort().join('+')}`);
      syncAndSave({
        machine: { ...get().machine, ...partial },
      });
    },

    reorderObjects: (newObjects: CADObject[]) => {
      pushHistory();
      syncAndSave({ objects: newObjects });
    },

    optimizeRoute: () => {
      const currentObjs = get().objects;
      if (!currentObjs || currentObjs.length === 0) return null;

      pushHistory();
      const off = get().machine.workOffset;
      const res = optimizeCADObjects(currentObjs, { x: -off.x, y: -off.y });

      // Sync operations linkedObjectIds order with new object order
      const newObjOrderMap = new Map<string, number>();
      res.optimizedObjects.forEach((obj, idx) => {
        newObjOrderMap.set(obj.id, idx);
      });

      const updatedOps = get().operations.map((op) => {
        const sortedLinked = [...op.linkedObjectIds].sort((a, b) => {
          const idxA = newObjOrderMap.get(a) ?? 9999;
          const idxB = newObjOrderMap.get(b) ?? 9999;
          return idxA - idxB;
        });
        return { ...op, linkedObjectIds: sortedLinked };
      });

      syncAndSave({
        objects: res.optimizedObjects,
        operations: updatedOps,
      });

      return res;
    },

    addObject: (rawObj: NewCADObjectInput) => {
      pushHistory();
      const newObj: CADObject = {
        ...rawObj,
        id: rawObj.id || `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      } as CADObject;

      const newObjs = [...get().objects, newObj];

      // Auto link to first matching operation or create new default operation if missing
      // ВАЖНО: ops — поверхностная копия, поэтому ops[0] перезаписываем НОВЫМ объектом
      // с новым массивом linkedObjectIds. Push прямо в ops[0].linkedObjectIds мутировал
      // бы массив, разделяемый с состоянием стора и снапшотами истории.
      let ops = [...get().operations];
      if (ops.length > 0) {
        ops[0] = { ...ops[0], linkedObjectIds: [...ops[0].linkedObjectIds, newObj.id] };
      } else {
        const newOp: OperationItem = {
          id: `op_${Date.now()}`,
          name: `Обработка ${newObj.name}`,
          enabled: true,
          type: newObj.type === 'point' ? 'drill' : 'cutContour',
          linkedObjectIds: [newObj.id],
          safeZ: get().machine.safeZ,
          startZ: 0,
          finalDepth: newObj.depth || 5,
          passDepth: newObj.depth || 5,
          spindleSpeed: get().machine.spindleSpeed,
          feedCut: get().machine.feedCut,
          feedPlunge: get().machine.feedPlunge,
          feedDrill: get().machine.feedDrill,
          direction: 'cw',
        };
        ops.push(newOp);
      }

      syncAndSave({
        objects: newObjs,
        operations: ops,
        selectedObjectIds: [newObj.id],
      });
    },

    recordHistory: () => {
      pushHistory();
    },

    updateObject: (id: string, partial: Partial<CADObject>, saveHistory = true) => {
      if (saveHistory) {
        pushHistoryCoalesced(`obj:${id}:${Object.keys(partial).sort().join('+')}`);
      }
      const newObjs = get().objects.map((o) => (o.id === id ? ({ ...o, ...partial } as CADObject) : o));
      syncAndSave({ objects: newObjs });
    },

    updateSelectedObjects: (partial: Partial<CADObject>, saveHistory = true) => {
      const selectedSet = new Set(get().selectedObjectIds);
      if (selectedSet.size === 0) return;
      if (saveHistory) {
        pushHistory();
      }
      const newObjs = get().objects.map((o) =>
        selectedSet.has(o.id) ? ({ ...o, ...partial } as CADObject) : o
      );
      syncAndSave({ objects: newObjs });
    },

    updateObjectsBulk: (updates, saveHistory = true) => {
      if (updates.length === 0) return;
      if (saveHistory) {
        pushHistory();
      }
      const patchMap = new Map(updates.map((u) => [u.id, u.patch]));
      const newObjs = get().objects.map((o) =>
        patchMap.has(o.id) ? ({ ...o, ...patchMap.get(o.id) } as CADObject) : o
      );
      syncAndSave({ objects: newObjs });
    },

    deleteObject: (id: string) => {
      const curIds = get().selectedObjectIds;
      if (curIds.includes(id) && curIds.length > 1) {
        get().deleteSelectedObjects();
        return;
      }

      pushHistory();
      const newObjs = get().objects.filter((o) => o.id !== id);
      const newOps = get().operations.map((op) => ({
        ...op,
        linkedObjectIds: op.linkedObjectIds.filter((objId) => objId !== id),
      }));
      const remainingSelected = curIds.filter((i) => i !== id);
      syncAndSave({
        objects: newObjs,
        operations: newOps,
        selectedObjectIds: remainingSelected,
      });
    },

    deleteSelectedObjects: () => {
      const ids = get().selectedObjectIds;
      if (ids.length === 0) return;

      pushHistory();
      const idSet = new Set(ids);
      const newObjs = get().objects.filter((o) => !idSet.has(o.id));
      const newOps = get().operations.map((op) => ({
        ...op,
        linkedObjectIds: op.linkedObjectIds.filter((objId) => !idSet.has(objId)),
      }));

      syncAndSave({
        objects: newObjs,
        operations: newOps,
        selectedObjectIds: [],
      });
    },

    duplicateObject: (id: string) => {
      const target = get().objects.find((o) => o.id === id);
      if (!target) return;

      pushHistory();
      const copy: CADObject = JSON.parse(JSON.stringify(target));
      copy.id = `obj_${Date.now()}`;
      copy.name = `${target.name} (копия)`;

      // Offset position slightly
      if (copy.type === 'point') {
        copy.x += 10;
        copy.y += 10;
      } else if (copy.type === 'line') {
        copy.startX += 10;
        copy.startY += 10;
        copy.endX += 10;
        copy.endY += 10;
      } else if (copy.type === 'rectangle') {
        copy.x += 10;
        copy.y += 10;
      } else if (copy.type === 'circle') {
        copy.centerX += 10;
        copy.centerY += 10;
      } else if (copy.type === 'arc') {
        copy.startX += 10;
        copy.startY += 10;
        copy.endX += 10;
        copy.endY += 10;
        copy.centerX += 10;
        copy.centerY += 10;
      }

      const newObjs = [...get().objects, copy];
      // Add to operations linked to target
      const newOps = get().operations.map((op) => {
        if (op.linkedObjectIds.includes(id)) {
          return { ...op, linkedObjectIds: [...op.linkedObjectIds, copy.id] };
        }
        return op;
      });

      syncAndSave({
        objects: newObjs,
        operations: newOps,
        selectedObjectIds: [copy.id],
      });
    },

    // Ctrl+C — запомнить ГЛУБОКИЕ копии всех выделенных фигур в транзиентный буфер.
    // Обычный set: не пишет историю и не триггерит генерацию G-кода/автосейв.
    copySelectedObjects: () => {
      const ids = new Set(get().selectedObjectIds);
      if (ids.size === 0) return;
      const snapshot = get()
        .objects.filter((o) => ids.has(o.id))
        .map((o) => structuredClone(o));
      set({ clipboard: snapshot, clipboardSeq: 0 });
    },

    // Ctrl+V — вставить копию группы. Каждая последующая вставка смещается дальше,
    // чтобы копии не ложились друг на друга. Вставленные фигуры разблокированы
    // (frozen=false), получают новые id и связываются с теми же операциями, что и оригиналы.
    pasteClipboard: () => {
      const clip = get().clipboard;
      if (!clip || clip.length === 0) return;

      const seq = get().clipboardSeq + 1;
      const off = 15 * seq;
      const ts = Date.now();
      const idMap = new Map<string, string>();
      const newObjs: CADObject[] = clip.map((src, i) => {
        const copy = translateCADObject(src, off, off);
        const newId = `obj_${ts}_${Math.random().toString(36).substring(2, 7)}_${i}`;
        idMap.set(src.id, newId);
        copy.id = newId;
        copy.name = `${src.name} (копия)`;
        copy.frozen = false;
        return copy;
      });

      const newOps = get().operations.map((op) => {
        const additions = op.linkedObjectIds
          .filter((lid) => idMap.has(lid))
          .map((lid) => idMap.get(lid)!);
        if (additions.length === 0) return op;
        return { ...op, linkedObjectIds: [...op.linkedObjectIds, ...additions] };
      });

      pushHistory();
      syncAndSave({
        objects: [...get().objects, ...newObjs],
        operations: newOps,
        clipboardSeq: seq,
        selectedObjectIds: newObjs.map((o) => o.id),
      });
    },

    // Точное перемещение всего выделения на сдвиг (dx, dy) мм относительно текущего
    // положения. id сохраняются — фигуры просто едут; одна запись истории, пересчёт G-кода.
    moveSelectedObjectsBy: (dx: number, dy: number) => {
      const movable = new Set(
        get().objects.filter((o) => o.frozen !== true).map((o) => o.id)
      );
      const ids = new Set(get().selectedObjectIds.filter((id) => movable.has(id)));
      if (ids.size === 0) return;
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
      pushHistory();
      const newObjs = get().objects.map((o) => (ids.has(o.id) ? translateCADObject(o, dx, dy) : o));
      syncAndSave({ objects: newObjs });
    },

    // Точное растяжение всего выделения относительно якоря (обычно — центр рамки
    // выделения). Замороженные фигуры не трогаются; sx/sy близкие к 1 игнорируются.
    // Одна запись истории, пересчёт G-кода.
    scaleSelectedObjectsBy: (anchor: Point2D, sx: number, sy: number) => {
      const movable = new Set(
        get().objects.filter((o) => o.frozen !== true).map((o) => o.id)
      );
      const ids = new Set(get().selectedObjectIds.filter((id) => movable.has(id)));
      if (ids.size === 0) return;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
      if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return;
      pushHistory();
      const newObjs = get().objects.map((o) =>
        ids.has(o.id) ? scaleCADObject(o, anchor, sx, sy) : o
      );
      syncAndSave({ objects: newObjs });
    },

    addOperation: (op: OperationItem) => {
      pushHistory();
      syncAndSave({
        operations: [...get().operations, op],
        selectedOperationId: op.id,
      });
    },

    updateOperation: (id: string, partial: Partial<OperationItem>) => {
      pushHistory();
      const newOps = get().operations.map((op) => (op.id === id ? { ...op, ...partial } : op));

      // Keep hole depth in sync: the generator reads a point's own `depth` for drilling.
      // Editing depth at the operation level must flow into the linked holes.
      const merged = newOps.find((op) => op.id === id);
      let payload: Partial<ProjectStore> = { operations: newOps };
      if (merged && typeof partial.finalDepth === 'number' && merged.linkedObjectIds.length > 0) {
        const linked = new Set(merged.linkedObjectIds);
        const newObjs = get().objects.map((o) =>
          linked.has(o.id) && o.type === 'point' ? ({ ...o, depth: partial.finalDepth } as CADObject) : o
        );
        payload = { operations: newOps, objects: newObjs };
      }
      syncAndSave(payload);
    },

    deleteOperation: (id: string) => {
      pushHistory();
      const newOps = get().operations.filter((op) => op.id !== id);
      syncAndSave({
        operations: newOps,
        selectedOperationId: get().selectedOperationId === id ? null : get().selectedOperationId,
      });
    },

    reorderOperations: (newOps: OperationItem[]) => {
      pushHistory();
      syncAndSave({ operations: newOps });
    },

    toggleOperationEnabled: (id: string) => {
      pushHistory();
      const newOps = get().operations.map((op) => (op.id === id ? { ...op, enabled: !op.enabled } : op));
      syncAndSave({ operations: newOps });
    },

    updateManualGcode: (code: string) => {
      set({ manualGcode: code, manualGcodeDirty: true });
    },

    parseManualGcode: () => {
      const gcode = get().manualGcode;
      const segs = parseGcodeToSegments(gcode);

      const extracted = extractProjectDataFromNC(gcode);
      if (extracted && Array.isArray(extracted.objects) && extracted.objects.length > 0) {
        pushHistory();
        syncAndSave({
          objects: extracted.objects,
          operations: extracted.operations || get().operations,
          viewMode: 'preview',
        });
        return;
      }

      const existingObjs = get().objects;
      const updatedCadObjects = parseGcodeToCadObjects(gcode, existingObjs);

      if (updatedCadObjects.length > 0) {
        pushHistory();

        const existingOps = get().operations;
        const updatedObjIds = new Set(updatedCadObjects.map((o) => o.id));

        let finalOps = existingOps
          .map((op) => ({
            ...op,
            linkedObjectIds: op.linkedObjectIds.filter((id) => updatedObjIds.has(id)),
          }))
          .filter((op) => op.linkedObjectIds.length > 0);

        const currentLinkedIds = new Set(finalOps.flatMap((op) => op.linkedObjectIds));
        const unlinkedObjs = updatedCadObjects.filter((o) => !currentLinkedIds.has(o.id));

        if (unlinkedObjs.length > 0) {
          if (finalOps.length > 0) {
            finalOps[0] = {
              ...finalOps[0],
              linkedObjectIds: [...finalOps[0].linkedObjectIds, ...unlinkedObjs.map((o) => o.id)],
            };
          } else {
            finalOps = [
              {
                id: `op_${Date.now()}`,
                name: 'Обработка контуров',
                enabled: true,
                type: 'cutContour',
                linkedObjectIds: unlinkedObjs.map((o) => o.id),
                safeZ: get().machine.safeZ,
                startZ: 0,
                finalDepth: unlinkedObjs[0]?.depth || 5,
                passDepth: unlinkedObjs[0]?.depth || 5,
                spindleSpeed: get().machine.spindleSpeed,
                feedCut: get().machine.feedCut || 1200,
                feedPlunge: get().machine.feedPlunge || 300,
                feedDrill: get().machine.feedDrill || 500,
                direction: 'cw',
              },
            ];
          }
        }

        syncAndSave({
          objects: updatedCadObjects,
          operations: finalOps,
          toolpathSegments: segs,
          viewMode: 'preview',
        });
      } else {
        set({ toolpathSegments: segs, viewMode: 'preview' });
      }
    },

    regenerateGcode: () => {
      const { objects, operations, machine, templates } = get();
      const res = generateGcode(objects, operations, machine, templates);
      set({
        generatedGcode: res.gcode,
        manualGcode: res.gcode,
        manualGcodeDirty: false,
        toolpathSegments: res.segments,
      });
    },

    newProject: (mode: ProjectMode) => {
      pushHistory();
      syncAndSave({
        projectName: 'Новый_Проект_ЧПУ',
        // Режим, выбранный при создании: свой лист и фреза.
        machine: structuredClone(PROJECT_MODE_PRESETS[mode]),
        objects: [],
        operations: [],
        manualGcodeDirty: false,
        selectedObjectIds: [],
        selectedOperationId: null,
        underlay: DEFAULT_UNDERLAY,
        activeTool: 'select',
      });
    },

    loadProjectJSON: (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as ProjectData;
        if (parsed && Array.isArray(parsed.objects)) {
          pushHistory();
          syncAndSave({
            projectName: parsed.name || 'Загруженный_Проект',
            machine: { ...INITIAL_MACHINE, ...parsed.machine, controllerProfile: 'ncstudio' },
            objects: parsed.objects,
            operations: parsed.operations || [],
            templates: parsed.postprocessorTemplates || DEFAULT_TEMPLATES,
            manualGcodeDirty: false,
            selectedObjectIds: [],
            selectedOperationId: null,
            underlay: DEFAULT_UNDERLAY,
          });
          return true;
        }
      } catch (e) {
        console.error('Failed to parse project JSON', e);
      }
      return false;
    },

    loadProjectNC: (fileContent: string, fileName?: string) => {
      if (!fileContent) return false;

      // 1. Try extracting embedded project JSON or raw JSON
      const extracted = extractProjectDataFromNC(fileContent);
      if (extracted && Array.isArray(extracted.objects)) {
        pushHistory();
        syncAndSave({
          projectName: extracted.name || fileName?.replace(/\.[^/.]+$/, '') || 'Проект_NcStudio',
          machine: { ...INITIAL_MACHINE, ...extracted.machine, controllerProfile: 'ncstudio' },
          objects: extracted.objects,
          operations: extracted.operations || [],
          templates: extracted.postprocessorTemplates || DEFAULT_TEMPLATES,
          manualGcodeDirty: false,
          selectedObjectIds: [],
          selectedOperationId: null,
          underlay: DEFAULT_UNDERLAY,
        });
        return true;
      }

      // 2. Process as raw NC Studio G-code file
      const parsedSegments = parseGcodeToSegments(fileContent);
      if (parsedSegments.length > 0) {
        pushHistory();
        const importedCadObjects = parseGcodeToCadObjects(fileContent);
        const cleanName = fileName?.replace(/\.[^/.]+$/, '') || 'Импортированная_Программа_NC';

        const newOps: OperationItem[] = importedCadObjects.map((obj, idx) => ({
          id: `op_imp_${idx + 1}`,
          name: `Обработка ${obj.name}`,
          enabled: true,
          type: obj.type === 'point' ? 'drill' : 'cutContour',
          linkedObjectIds: [obj.id],
          safeZ: get().machine.safeZ,
          startZ: 0,
          finalDepth: obj.depth || 5,
          passDepth: obj.depth || 5,
          spindleSpeed: get().machine.spindleSpeed,
          feedCut: obj.importedFeedCut || get().machine.feedCut || 1200,
          feedPlunge: obj.importedFeedPlunge || get().machine.feedPlunge || 300,
          feedDrill: get().machine.feedDrill || 500,
          direction: 'cw',
        }));

        syncAndSave({
          projectName: cleanName,
          manualGcode: fileContent,
          manualGcodeDirty: true,
          objects: importedCadObjects.length > 0 ? importedCadObjects : get().objects,
          operations: newOps.length > 0 ? newOps : get().operations,
          selectedObjectIds: [],
          selectedOperationId: null,
          underlay: DEFAULT_UNDERLAY,
          viewMode: 'preview',
        });

        return true;
      }

      return false;
    },

    exportProjectJSON: () => {
      const exportData: ProjectData = {
        version: '1.0',
        name: get().projectName,
        machine: { ...get().machine, controllerProfile: 'ncstudio' },
        objects: get().objects,
        operations: get().operations,
        postprocessorTemplates: get().templates,
      };
      return JSON.stringify(exportData, null, 2);
    },

    // Clean G-code for the machine — no embedded "; NCSTUDIO_PROJECT" metadata and no
    // per-object ";[ID: ...]" comment headers (those stay only in the editor/preview G-code).
    exportGcode: () => {
      const gcode = get().generatedGcode || get().manualGcode;
      return gcode
        .split('\n')
        .filter((line) => !OBJECT_MARKER_LINE_RE.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimStart();
    },

    undo: () => {
      lastCoalesceKey = null; // после undo следующая правка всегда пишет новый шаг
      const undoStack = get().historyUndo;
      if (undoStack.length === 0) return;

      const previous = undoStack[undoStack.length - 1];
      const newUndo = undoStack.slice(0, undoStack.length - 1);

      const currentSnapshot: HistoryState = {
        objects: structuredClone(get().objects),
        operations: structuredClone(get().operations),
        machine: structuredClone(get().machine),
      };

      syncAndSave({
        objects: previous.objects,
        operations: previous.operations,
        machine: previous.machine,
        historyUndo: newUndo,
        historyRedo: [currentSnapshot, ...get().historyRedo.slice(0, HISTORY_LIMIT - 1)],
      });
    },

    redo: () => {
      lastCoalesceKey = null; // симметрично undo: после redo — всегда новый шаг
      const redoStack = get().historyRedo;
      if (redoStack.length === 0) return;

      const next = redoStack[0];
      const newRedo = redoStack.slice(1);

      const currentSnapshot: HistoryState = {
        objects: structuredClone(get().objects),
        operations: structuredClone(get().operations),
        machine: structuredClone(get().machine),
      };

      syncAndSave({
        objects: next.objects,
        operations: next.operations,
        machine: next.machine,
        historyUndo: [...get().historyUndo, currentSnapshot].slice(-HISTORY_LIMIT),
        historyRedo: newRedo,
      });
    },
  };
});

// --- Производные селекторы выделения ---
// selectedObjectIds — единственный источник истины; «основная» фигура (для
// панели Свойств, грифов и подсветки) = ПОСЛЕДНИЙ id. Индекс в конце массива
// выбран потому, что так исторически проставлялось удалённое поле selectedObjectId.

/** React-хук: id основной выбранной фигуры или null. */
export const useSelectedObjectId = (): string | null =>
  useProjectStore((s) => getLastSelectedId(s.selectedObjectIds));

/** Чистая функция для императивных мест (onCreateEditor, обработчики). */
export function getLastSelectedId(ids: string[]): string | null {
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

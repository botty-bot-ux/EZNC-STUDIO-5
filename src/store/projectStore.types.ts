import type { StoreApi } from 'zustand';
import {
  ActiveTab,
  ActiveTool,
  AlignMode,
  ArcMode,
  CADObject,
  CanvasFocusRequest,
  GcodeScrollPreview,
  LineMode,
  LiveRotateState,
  LiveScaleState,
  MachineSettings,
  MobileSheet,
  NewCADObjectInput,
  ParallelPreviewState,
  Point2D,
  PostprocessorTemplates,
  RenderMode,
  StockAlignMode,
  StockSheetSettings,
  ToolpathSegment,
  UnderlayState,
  ViewMode,
  WarningItem,
} from '../types';
import { OptimizationResult } from '../lib/geometry/optimizer';
import { ProjectMode } from './initialState';
import { Theme } from './theme';

export type { Theme };

export interface PendingVectorImport {
  fileName: string;
  content: string;
  format: 'dxf' | 'svg';
}

export type ShapeDialogState =
  | { kind: 'move' | 'scale' | 'parallel' | 'array' | 'rotate' | 'import' }
  | null;

export interface ToastNotice {
  id: number;
  text: string;
  isError?: boolean;
}

interface HistoryState {
  objects: CADObject[];
  machine: MachineSettings;
}

export interface NewProjectOptions {
  bounds?: Partial<MachineSettings['bounds']>;
  stockSheet?: Partial<StockSheetSettings>;
}

export interface ProjectStore {
  projectName: string;
  machine: MachineSettings;
  objects: CADObject[];
  templates: PostprocessorTemplates;

  // selectedObjectIds — ЕДИНСТВЕННЫЙ источник истины о выделении; «основная»
  // фигура (для панели свойств и грифов) = последний id. Доступна через хук
  // useSelectedObjectId() в конце файла. Раньше дублировалась полем
  // selectedObjectId, которое расходилось с массивом при загрузке проектов.
  selectedObjectIds: string[];
  // Модалки действий с фигурами («Переместить», «Масштабировать», «Повернуть», «Импорт DXF/SVG» и др.)
  // живут на уровне App (ShapeActionsHost) и открываются по запросу.
  shapeDialog: ShapeDialogState;
  setShapeDialog: (d: ShapeDialogState) => void;
  pendingVectorImport: PendingVectorImport | null;
  setPendingVectorImport: (v: PendingVectorImport | null) => void;
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
  // Живое превью модуля «Повернуть на угол»: поворот выбранных фигур вокруг якоря до подтверждения.
  liveRotate: LiveRotateState | null;
  // Живое превью модуля «Параллельная линия»: штриховые копии будущих линий на холсте
  // до подтверждения. Только отрисовка — не трогает objects/историю/G-код.
  parallelPreview: ParallelPreviewState | null;
  // Session-only background reference image («подложка»). Never persisted, never affects G-code.
  underlay: UnderlayState;
  activeTool: ActiveTool;
  // Текущий радиус скругления углов (мм) для инструмента «Скругление».
  filletRadius: number;
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
  // Какое представление активно в области холста: 2D-редактор или 3D-сцена симуляции.
  renderMode: RenderMode;
  // ID фигуры/слоя, который сейчас прорезается в 3D-симуляции. Транзиентное
  // превью-состояние (как liveMove/parallelPreview): не в objects, не в истории,
  // не в автосейве. Пишется из useFrame только при СМЕНИ слоя.
  simActiveLayerId: string | null;
  // Транзиентная подсветка активных строк G-кода на 2D-холсте при прокрутке редактора.
  gcodeScrollPreview: GcodeScrollPreview | null;
  // Запрос центрирования 2D-холста на области или фигуре.
  canvasFocusRequest: CanvasFocusRequest | null;
  // Запрос вписать рабочую зону в экран (для вызова из левой линейки инструментов).
  canvasFitSeq: number;

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
  // Выдвижная панель списка предупреждений безопасности в футере инспектора.
  safetyDrawerOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setSafetyDrawerOpen: (open: boolean) => void;
  openSafetyDrawer: () => void;

  // Мобильная шторка (сессонное состояние, не сохраняется).
  mobileSheet: MobileSheet;
  setMobileSheet: (sheet: MobileSheet) => void;

  // Единое всплывающее уведомление (загрузка/сохранение файлов, пресеты, оптимизация).
  toast: ToastNotice | null;
  showToast: (text: string, isError?: boolean) => void;
  clearToast: () => void;

  // Actions
  setProjectName: (name: string) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setFilletRadius: (r: number) => void;
  setArcMode: (mode: ArcMode) => void;
  setLineMode: (mode: LineMode) => void;
  setCanvasGrabbing: (grabbing: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setRenderMode: (mode: RenderMode) => void;
  setSimActiveLayerId: (id: string | null) => void;
  setGcodeScrollPreview: (v: GcodeScrollPreview | null) => void;
  focusCanvasOnBounds: (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => void;
  focusCanvasOnObject: (id: string) => void;
  requestFitView: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridStep: (step: number) => void;
  setSelectedObjectId: (id: string | null) => void;
  setSelectedObjectIds: (ids: string[]) => void;
  toggleObjectSelection: (id: string) => void;
  selectAllObjects: () => void;
  setLiveEdit: (v: { id: string; patch: Partial<CADObject> } | null) => void;
  setLiveMeasure: (v: { start: Point2D; end: Point2D } | null) => void;
  setLiveMove: (v: { ids: string[]; dx: number; dy: number } | null) => void;
  setLiveScale: (v: LiveScaleState | null) => void;
  setLiveRotate: (v: LiveRotateState | null) => void;
  setParallelPreview: (v: ParallelPreviewState | null) => void;

  // Подложка (фоновая референсная картинка) — только на сессию.
  setUnderlayImage: (src: string) => void;
  updateUnderlay: (partial: Partial<UnderlayState>) => void;
  fitUnderlayToSheet: () => void;
  clearUnderlay: () => void;

  updateMachine: (partial: Partial<MachineSettings>) => void;
  applyMachinePreset: (mode: ProjectMode) => void;

  reorderObjects: (newObjects: CADObject[]) => void;
  optimizeRoute: () => OptimizationResult | null;
  addObject: (obj: NewCADObjectInput) => void;
  addObjectsBulk: (objs: NewCADObjectInput[]) => void;
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
  // Зеркалирование, поворот на 90°/произвольный угол, объединение, выравнивание и массив.
  mirrorSelectedObjects: (axis: 'x' | 'y') => void;
  rotateSelectedObjects: (angleDeg: 90 | -90 | 180) => void;
  rotateSelectedObjectsByAngle: (angleDeg: number, anchorMode: 'selection' | 'origin') => void;
  alignSelectedObjects: (mode: AlignMode) => void;
  alignSelectedObjectsToStock: (mode: StockAlignMode, marginMm?: number) => void;
  joinSelectedObjects: () => number;
  trimObjectAtPoint: (objectId: string, worldPt: Point2D) => boolean;
  filletLines: (
    idA: string,
    idB: string,
    radius: number,
    clickA?: Point2D,
    clickB?: Point2D
  ) => { ok: boolean; reason?: string };
  filletRectangle: (id: string, radius: number) => { ok: boolean; reason?: string };
  arraySelectedObjects: (countX: number, stepX: number, countY: number, stepY: number) => void;

  updateManualGcode: (code: string) => void;
  parseManualGcode: () => void;

  regenerateGcode: () => void;
  newProject: (mode: ProjectMode, options?: NewProjectOptions) => void;
  loadProjectJSON: (jsonStr: string) => boolean;
  loadProjectNC: (fileContent: string, fileName?: string) => boolean;
  importVectorObjects: (
    objs: NewCADObjectInput[],
    mode: 'append' | 'replace',
    suggestedName?: string
  ) => void;
  exportProjectJSON: () => string;
  exportGcode: () => string;

  undo: () => void;
  redo: () => void;
}

export type { HistoryState };

// Общий контекст для всех срезов стора: мутаторы zustand + общие хелперы
// истории/синхронизации. Все срезы замыкаются на ОДИН экземпляр контекста,
// созданного внутри create(), поэтому семантика совпадает с прежним монолитом.
export type StoreSet = StoreApi<ProjectStore>['setState'];

export interface StoreCtx {
  set: StoreSet;
  get: () => ProjectStore;
  pushHistory: () => void;
  pushHistoryCoalesced: (key: string) => void;
  resetHistoryCoalescing: () => void;
  syncAndSave: (stateUpdate: Partial<ProjectStore>) => void;
}

import { create } from 'zustand';
import { DEFAULT_UNDERLAY } from './initialState';
import { ProjectStore, StoreCtx } from './projectStore.types';
import { loadInitialProjectState } from './projectStoreInit';
import { makeStoreCore } from './projectStoreCore';
import { createUiSlice } from './slices/uiSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createObjectsSlice } from './slices/objectsSlice';
import { createOperationsSlice } from './slices/operationsSlice';
import { createGcodeSlice } from './slices/gcodeSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createHistorySlice } from './slices/historySlice';

export type { Theme } from './theme';
export type { ProjectStore } from './projectStore.types';

// Глобальный стор проекта (Zustand). Реализация разбита на срезы (store/slices/*),
// которые собираются здесь в один create() и разделяют ОДИН контекст set/get +
// общие хелперы истории/синхронизации (makeStoreCore). Публичный API не изменился:
// `useProjectStore`, `useSelectedObjectId`, `getLastSelectedId`, `Theme`.
export const useProjectStore = create<ProjectStore>((set, get) => {
  const core = makeStoreCore(set, get);
  const ctx: StoreCtx = { set, get, ...core };
  const loaded = loadInitialProjectState();

  return {
    projectName: loaded.projectName,
    machine: loaded.machine,
    objects: loaded.objects,
    operations: loaded.operations,
    templates: loaded.templates,

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
    renderMode: '2d',
    simActiveLayerId: null,

    theme: loaded.theme,

    snapToGrid: true,
    gridStep: 1,

    generatedGcode: loaded.generatedGcode,
    manualGcode: loaded.generatedGcode,
    manualGcodeDirty: false,
    toolpathSegments: loaded.toolpathSegments,
    warnings: loaded.warnings,

    clipboard: [],
    clipboardSeq: 0,

    historyUndo: [],
    historyRedo: [],

    leftPanelOpen: true,
    rightPanelOpen: true,
    panelDismissed: false,

    mobileSheet: 'none',

    // Действия, собранные из срезов (общий ctx → та же история/автосейв, что и в монолите).
    ...createUiSlice(ctx),
    ...createSelectionSlice(ctx),
    ...createObjectsSlice(ctx),
    ...createOperationsSlice(ctx),
    ...createGcodeSlice(ctx),
    ...createProjectSlice(ctx),
    ...createHistorySlice(ctx),
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

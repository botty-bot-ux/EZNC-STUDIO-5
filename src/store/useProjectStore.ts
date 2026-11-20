import { create } from 'zustand';
import { DEFAULT_UNDERLAY } from './initialState';
import { ProjectStore, StoreCtx } from './projectStore.types';
import { loadInitialProjectState } from './projectStoreInit';
import { makeStoreCore } from './projectStoreCore';
import { createUiSlice } from './slices/uiSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createMachineSlice } from './slices/machineSlice';
import { createObjectsCrudSlice } from './slices/objectsCrudSlice';
import { createObjectsTransformSlice } from './slices/objectsTransformSlice';
import { createGcodeSlice } from './slices/gcodeSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createHistorySlice } from './slices/historySlice';

export type { Theme } from './theme';
export type { ProjectStore } from './projectStore.types';

// Глобальный стор проекта (Zustand). Реализация разбита на срезы (store/slices/*),
// которые собираются здесь в один create() и разделяют ОДИН контекст set/get +
// общие хелперы истории/синхронизации (makeStoreCore).
export const useProjectStore = create<ProjectStore>((set, get) => {
  const core = makeStoreCore(set, get);
  const ctx: StoreCtx = { set, get, ...core };
  const loaded = loadInitialProjectState();

  return {
    projectName: loaded.projectName,
    machine: loaded.machine,
    objects: loaded.objects,
    templates: loaded.templates,

    selectedObjectIds: [],
    shapeDialog: null,
    pendingVectorImport: null,
    liveEdit: null,
    liveMeasure: null,
    liveMove: null,
    liveScale: null,
    liveRotate: null,
    parallelPreview: null,
    underlay: DEFAULT_UNDERLAY,
    activeTool: 'select',
    filletRadius: 10,
    arcMode: 'bulge',
    lineMode: 'line',
    canvasGrabbing: false,
    activeTab: 'properties',
    viewMode: 'edit',
    renderMode: '2d',
    simActiveLayerId: null,
    gcodeScrollPreview: null,
    canvasFocusRequest: null,
    canvasFitSeq: 0,

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
    safetyDrawerOpen: false,

    mobileSheet: 'none',
    toast: null,

    // Действия, собранные из срезов (общий ctx → единая история и атомарный автосейв).
    ...createUiSlice(ctx),
    ...createSelectionSlice(ctx),
    ...createMachineSlice(ctx),
    ...createObjectsCrudSlice(ctx),
    ...createObjectsTransformSlice(ctx),
    ...createGcodeSlice(ctx),
    ...createProjectSlice(ctx),
    ...createHistorySlice(ctx),
  };
});

// --- Производные селекторы выделения ---
// selectedObjectIds — единственный источник истины; «основная» фигура (для
// панели Свойств, грифов и подсветки) = ПОСЛЕДНИЙ id.

/** React-хук: id основной выбранной фигуры или null. */
export const useSelectedObjectId = (): string | null =>
  useProjectStore((s) => getLastSelectedId(s.selectedObjectIds));

/** Чистая функция для императивных мест (onCreateEditor, обработчики). */
export function getLastSelectedId(ids: string[]): string | null {
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

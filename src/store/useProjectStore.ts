import { create } from 'zustand';
import {
  ActiveTab,
  ActiveTool,
  CADObject,
  MachineSettings,
  MobileSheet,
  NewCADObjectInput,
  OperationItem,
  Point2D,
  PostprocessorTemplates,
  ProjectData,
  ToolpathSegment,
  UnderlayState,
  ViewMode,
  WarningItem,
} from '../types';
import { generateGcode, generateNCFileWithMetadata } from '../lib/gcode/generator';
import { extractProjectDataFromNC, parseGcodeToCadObjects, parseGcodeToSegments } from '../lib/gcode/parser';
import { DEFAULT_TEMPLATES } from '../lib/postprocessor/templates';
import { analyzeProjectWarnings } from '../lib/utils/warnings';
import { optimizeCADObjects, OptimizationResult } from '../lib/geometry/optimizer';
import {
  INITIAL_MACHINE,
  INITIAL_OBJECTS,
  INITIAL_OPERATIONS,
  LOCAL_STORAGE_KEY,
  DEFAULT_UNDERLAY,
} from './initialState';

interface HistoryState {
  objects: CADObject[];
  operations: OperationItem[];
  machine: MachineSettings;
}

interface ProjectStore {
  projectName: string;
  machine: MachineSettings;
  objects: CADObject[];
  operations: OperationItem[];
  templates: PostprocessorTemplates;

  selectedObjectId: string | null;
  selectedObjectIds: string[];
  selectedOperationId: string | null;
  // Which kind of entity the right-side Свойства inspector should render.
  inspectorTarget: 'object' | 'operation' | 'tool';
  // Transient interaction state surfaced to the Свойства panel during a drag / measure.
  // Kept out of `objects` so it never triggers history, autosave or G-code regen.
  liveEdit: { id: string; patch: Partial<CADObject> } | null;
  liveMeasure: { start: Point2D; end: Point2D } | null;
  // Session-only background reference image («подложка»). Never persisted, never affects G-code.
  underlay: UnderlayState;
  activeTool: ActiveTool;
  activeTab: ActiveTab;
  viewMode: ViewMode;

  snapToGrid: boolean;
  gridStep: number;

  generatedGcode: string;
  manualGcode: string;
  // True once the user hand-edits G-code in the editor; normal object edits then
  // stop overwriting `manualGcode` until an explicit regenerate/parse/load happens.
  manualGcodeDirty: boolean;
  toolpathSegments: ToolpathSegment[];
  warnings: WarningItem[];

  historyUndo: HistoryState[];
  historyRedo: HistoryState[];

  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Мобильная шторка (сессонное состояние, не сохраняется).
  mobileSheet: MobileSheet;
  setMobileSheet: (sheet: MobileSheet) => void;

  // Actions
  setProjectName: (name: string) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridStep: (step: number) => void;
  setSelectedObjectId: (id: string | null) => void;
  setSelectedObjectIds: (ids: string[]) => void;
  toggleObjectSelection: (id: string) => void;
  selectAllObjects: () => void;
  setSelectedOperationId: (id: string | null) => void;
  setInspectorTarget: (target: 'object' | 'operation' | 'tool') => void;
  setLiveEdit: (v: { id: string; patch: Partial<CADObject> } | null) => void;
  setLiveMeasure: (v: { start: Point2D; end: Point2D } | null) => void;

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

  addOperation: (op: OperationItem) => void;
  updateOperation: (id: string, partial: Partial<OperationItem>) => void;
  deleteOperation: (id: string) => void;
  reorderOperations: (newOps: OperationItem[]) => void;
  toggleOperationEnabled: (id: string) => void;

  updateManualGcode: (code: string) => void;
  parseManualGcode: () => void;

  regenerateGcode: () => void;
  newProject: () => void;
  loadProjectJSON: (jsonStr: string) => boolean;
  loadProjectNC: (fileContent: string, fileName?: string) => boolean;
  exportProjectJSON: () => string;
  exportProjectNC: () => string;
  exportGcode: () => string;

  undo: () => void;
  redo: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  const HISTORY_LIMIT = 20;

  // Helper to record history step. Snapshots the current (pre-change) state so that
  // an undo restores what was there before the action. Call BEFORE mutating state.
  const pushHistory = () => {
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

  return {
    projectName: initName,
    machine: initMachine,
    objects: initObjects,
    operations: initOperations,
    templates: initTemplates,

    selectedObjectId: null,
    selectedObjectIds: [],
    selectedOperationId: null,
    inspectorTarget: 'object',
    liveEdit: null,
    liveMeasure: null,
    underlay: DEFAULT_UNDERLAY,
    activeTool: 'select',
    activeTab: 'gcode',
    viewMode: 'edit',

    snapToGrid: true,
    gridStep: 1,

    generatedGcode: initialGen.gcode,
    manualGcode: initialGen.gcode,
    manualGcodeDirty: false,
    toolpathSegments: initialGen.segments,
    warnings: initialWarns,

    historyUndo: [],
    historyRedo: [],

    leftPanelOpen: true,
    rightPanelOpen: true,
    toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

    mobileSheet: 'none',
    setMobileSheet: (sheet: MobileSheet) => set({ mobileSheet: sheet }),

    setProjectName: (name: string) => syncAndSave({ projectName: name }),

    setActiveTool: (tool: ActiveTool) =>
      set((state) => ({
        activeTool: tool,
        ...(tool === 'measure'
          ? { activeTab: 'properties' as ActiveTab, mobileSheet: 'properties' as MobileSheet, rightPanelOpen: true, viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode }
          : {}),
      })),
    setActiveTab: (tab: ActiveTab) =>
      set((state) => ({
        activeTab: tab,
        mobileSheet: tab,
        rightPanelOpen: tab === 'properties' ? true : state.rightPanelOpen,
        viewMode: tab === 'gcode' ? 'gcode' : state.viewMode === 'gcode' ? 'edit' : state.viewMode,
      })),
    setViewMode: (mode: ViewMode) =>
      set((state) => ({
        viewMode: mode,
        activeTab: mode === 'gcode' ? 'gcode' : state.activeTab === 'gcode' ? 'machine' : state.activeTab,
        rightPanelOpen: mode === 'gcode' ? true : state.rightPanelOpen,
      })),
    setSnapToGrid: (snap: boolean) => set({ snapToGrid: snap }),
    setGridStep: (step: number) => set({ gridStep: step }),

    setSelectedObjectId: (id: string | null) =>
      set((state) => ({
        selectedObjectId: id,
        selectedObjectIds: id ? [id] : [],
        inspectorTarget: 'object',
        ...(id
          ? { activeTab: 'properties' as ActiveTab, rightPanelOpen: true, viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode }
          : {}),
      })),

    setSelectedObjectIds: (ids: string[]) =>
      set((state) => ({
        selectedObjectIds: ids,
        selectedObjectId: ids.length > 0 ? ids[ids.length - 1] : null,
        inspectorTarget: 'object',
        ...(ids.length > 0
          ? { activeTab: 'properties' as ActiveTab, rightPanelOpen: true, viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode }
          : {}),
      })),

    toggleObjectSelection: (id: string) => {
      const cur = get().selectedObjectIds;
      const exists = cur.includes(id);
      const newIds = exists ? cur.filter((i) => i !== id) : [...cur, id];
      set({
        selectedObjectIds: newIds,
        selectedObjectId: newIds.length > 0 ? newIds[newIds.length - 1] : null,
        inspectorTarget: 'object',
        ...(newIds.length > 0 ? { activeTab: 'properties' as ActiveTab, rightPanelOpen: true } : {}),
      });
    },

    selectAllObjects: () => {
      const visibleIds = get().objects.filter((o) => o.visible !== false).map((o) => o.id);
      set({
        selectedObjectIds: visibleIds,
        selectedObjectId: visibleIds.length > 0 ? visibleIds[visibleIds.length - 1] : null,
        inspectorTarget: 'object',
      });
    },

    setSelectedOperationId: (id: string | null) =>
      set({
        selectedOperationId: id,
        inspectorTarget: 'operation',
      }),

    setInspectorTarget: (target: 'object' | 'operation' | 'tool') =>
      set((state) => ({
        inspectorTarget: target,
        activeTab: 'properties',
        rightPanelOpen: true,
        viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode,
      })),

    setLiveEdit: (v) => set({ liveEdit: v }),
    setLiveMeasure: (v) => set({ liveMeasure: v }),

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
      pushHistory();
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
      let ops = [...get().operations];
      if (ops.length > 0) {
        ops[0].linkedObjectIds.push(newObj.id);
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
        selectedObjectId: newObj.id,
        selectedObjectIds: [newObj.id],
      });
    },

    recordHistory: () => {
      pushHistory();
    },

    updateObject: (id: string, partial: Partial<CADObject>, saveHistory = true) => {
      if (saveHistory) {
        pushHistory();
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
        selectedObjectId: remainingSelected.length > 0 ? remainingSelected[remainingSelected.length - 1] : null,
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
        selectedObjectId: null,
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
        selectedObjectId: copy.id,
        selectedObjectIds: [copy.id],
      });
    },

    addOperation: (op: OperationItem) => {
      pushHistory();
      syncAndSave({
        operations: [...get().operations, op],
        selectedOperationId: op.id,
        inspectorTarget: 'operation',
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

    newProject: () => {
      pushHistory();
      syncAndSave({
        projectName: 'Новый_Проект_ЧПУ',
        objects: [],
        operations: [],
        manualGcodeDirty: false,
        selectedObjectId: null,
        selectedOperationId: null,
        underlay: DEFAULT_UNDERLAY,
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
            selectedObjectId: null,
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
          selectedObjectId: null,
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
          selectedObjectId: null,
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

    exportProjectNC: () => {
      const exportData: ProjectData = {
        version: '1.0',
        name: get().projectName,
        machine: { ...get().machine, controllerProfile: 'ncstudio' },
        objects: get().objects,
        operations: get().operations,
        postprocessorTemplates: get().templates,
      };
      const gcode = get().generatedGcode || get().manualGcode;
      return generateNCFileWithMetadata(exportData, gcode);
    },

    // Clean G-code for the machine — no embedded "; NCSTUDIO_PROJECT" metadata and no
    // per-object ";[ID: ...]" comment headers (those stay only in the editor/preview G-code).
    exportGcode: () => {
      const gcode = get().generatedGcode || get().manualGcode;
      return gcode
        .split('\n')
        .filter((line) => !/^\s*;\s*\[ID:/i.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimStart();
    },

    undo: () => {
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

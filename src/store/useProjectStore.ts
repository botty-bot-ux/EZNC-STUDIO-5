import { create } from 'zustand';
import {
  ActiveTab,
  ActiveTool,
  CADObject,
  MachineSettings,
  NewCADObjectInput,
  OperationItem,
  PostprocessorTemplates,
  ProjectData,
  ToolpathSegment,
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
  selectedOperationId: string | null;
  activeTool: ActiveTool;
  activeTab: ActiveTab;
  viewMode: ViewMode;

  snapToGrid: boolean;
  gridStep: number;

  generatedGcode: string;
  manualGcode: string;
  toolpathSegments: ToolpathSegment[];
  warnings: WarningItem[];

  historyUndo: HistoryState[];
  historyRedo: HistoryState[];

  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Actions
  setProjectName: (name: string) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridStep: (step: number) => void;
  setSelectedObjectId: (id: string | null) => void;
  setSelectedOperationId: (id: string | null) => void;

  updateMachine: (partial: Partial<MachineSettings>) => void;

  reorderObjects: (newObjects: CADObject[]) => void;
  optimizeRoute: () => OptimizationResult | null;
  addObject: (obj: NewCADObjectInput) => void;
  updateObject: (id: string, partial: Partial<CADObject>, saveHistory?: boolean) => void;
  recordHistory: () => void;
  deleteObject: (id: string) => void;
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

  undo: () => void;
  redo: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  // Helper to record history step
  const pushHistory = (state: { objects: CADObject[]; operations: OperationItem[]; machine: MachineSettings }) => {
    const curUndo = get().historyUndo;
    set({
      historyUndo: [
        ...curUndo.slice(-20), // keep max 20 states
        {
          objects: JSON.parse(JSON.stringify(get().objects)),
          operations: JSON.parse(JSON.stringify(get().operations)),
          machine: JSON.parse(JSON.stringify(get().machine)),
        },
      ],
      historyRedo: [],
    });
  };

  // Helper to sync generation & warnings & local storage
  const syncAndSave = (stateUpdate: Partial<ProjectStore>) => {
    set(stateUpdate);
    const { objects, operations, machine, templates } = get();

    const genRes = generateGcode(objects, operations, machine, templates);
    const warnList = analyzeProjectWarnings(objects, operations, machine);

    set({
      generatedGcode: genRes.gcode,
      manualGcode: genRes.gcode,
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
        if (initMachine.safeZ === 10) {
          initMachine.safeZ = 20;
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
    selectedOperationId: null,
    activeTool: 'select',
    activeTab: 'properties',
    viewMode: 'edit',

    snapToGrid: true,
    gridStep: 1,

    generatedGcode: initialGen.gcode,
    manualGcode: initialGen.gcode,
    toolpathSegments: initialGen.segments,
    warnings: initialWarns,

    historyUndo: [],
    historyRedo: [],

    leftPanelOpen: true,
    rightPanelOpen: true,
    toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

    setProjectName: (name: string) => syncAndSave({ projectName: name }),

    setActiveTool: (tool: ActiveTool) => set({ activeTool: tool }),
    setActiveTab: (tab: ActiveTab) =>
      set((state) => ({
        activeTab: tab,
        viewMode: tab === 'gcode' ? 'gcode' : state.viewMode === 'gcode' ? 'edit' : state.viewMode,
      })),
    setViewMode: (mode: ViewMode) =>
      set((state) => ({
        viewMode: mode,
        activeTab: mode === 'gcode' ? 'gcode' : state.activeTab === 'gcode' ? 'properties' : state.activeTab,
        rightPanelOpen: mode === 'gcode' ? true : state.rightPanelOpen,
      })),
    setSnapToGrid: (snap: boolean) => set({ snapToGrid: snap }),
    setGridStep: (step: number) => set({ gridStep: step }),

    setSelectedObjectId: (id: string | null) =>
      set({
        selectedObjectId: id,
        activeTab: id ? 'properties' : get().activeTab,
      }),

    setSelectedOperationId: (id: string | null) =>
      set({
        selectedOperationId: id,
        activeTab: id ? 'properties' : get().activeTab,
      }),

    updateMachine: (partial: Partial<MachineSettings>) => {
      pushHistory(get());
      syncAndSave({
        machine: { ...get().machine, ...partial },
      });
    },

    reorderObjects: (newObjects: CADObject[]) => {
      pushHistory(get());
      syncAndSave({ objects: newObjects });
    },

    optimizeRoute: () => {
      const currentObjs = get().objects;
      if (!currentObjs || currentObjs.length === 0) return null;

      pushHistory(get());
      const res = optimizeCADObjects(currentObjs, { x: 0, y: 0 });

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
      pushHistory(get());
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
      });
    },

    recordHistory: () => {
      pushHistory(get());
    },

    updateObject: (id: string, partial: Partial<CADObject>, saveHistory = true) => {
      if (saveHistory) {
        pushHistory(get());
      }
      const newObjs = get().objects.map((o) => (o.id === id ? ({ ...o, ...partial } as CADObject) : o));
      syncAndSave({ objects: newObjs });
    },

    deleteObject: (id: string) => {
      pushHistory(get());
      const newObjs = get().objects.filter((o) => o.id !== id);
      const newOps = get().operations.map((op) => ({
        ...op,
        linkedObjectIds: op.linkedObjectIds.filter((objId) => objId !== id),
      }));
      syncAndSave({
        objects: newObjs,
        operations: newOps,
        selectedObjectId: get().selectedObjectId === id ? null : get().selectedObjectId,
      });
    },

    duplicateObject: (id: string) => {
      const target = get().objects.find((o) => o.id === id);
      if (!target) return;

      pushHistory(get());
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
      });
    },

    addOperation: (op: OperationItem) => {
      pushHistory(get());
      syncAndSave({
        operations: [...get().operations, op],
        selectedOperationId: op.id,
      });
    },

    updateOperation: (id: string, partial: Partial<OperationItem>) => {
      pushHistory(get());
      const newOps = get().operations.map((op) => (op.id === id ? { ...op, ...partial } : op));
      syncAndSave({ operations: newOps });
    },

    deleteOperation: (id: string) => {
      pushHistory(get());
      const newOps = get().operations.filter((op) => op.id !== id);
      syncAndSave({
        operations: newOps,
        selectedOperationId: get().selectedOperationId === id ? null : get().selectedOperationId,
      });
    },

    reorderOperations: (newOps: OperationItem[]) => {
      pushHistory(get());
      syncAndSave({ operations: newOps });
    },

    toggleOperationEnabled: (id: string) => {
      pushHistory(get());
      const newOps = get().operations.map((op) => (op.id === id ? { ...op, enabled: !op.enabled } : op));
      syncAndSave({ operations: newOps });
    },

    updateManualGcode: (code: string) => {
      set({ manualGcode: code });
    },

    parseManualGcode: () => {
      const gcode = get().manualGcode;
      const segs = parseGcodeToSegments(gcode);
      const importedCadObjects = parseGcodeToCadObjects(gcode);

      if (importedCadObjects.length > 0) {
        pushHistory(get());
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
          feedCut: (obj as any).importedFeedCut || get().machine.feedCut || 1200,
          feedPlunge: (obj as any).importedFeedPlunge || get().machine.feedPlunge || 300,
          feedDrill: get().machine.feedDrill || 500,
          direction: 'cw',
        }));

        syncAndSave({
          objects: importedCadObjects,
          operations: newOps,
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
        toolpathSegments: res.segments,
      });
    },

    newProject: () => {
      pushHistory(get());
      syncAndSave({
        projectName: 'Новый_Проект_ЧПУ',
        objects: [],
        operations: [],
        selectedObjectId: null,
        selectedOperationId: null,
      });
    },

    loadProjectJSON: (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as ProjectData;
        if (parsed && Array.isArray(parsed.objects)) {
          pushHistory(get());
          syncAndSave({
            projectName: parsed.name || 'Загруженный_Проект',
            machine: { ...INITIAL_MACHINE, ...parsed.machine, controllerProfile: 'ncstudio' },
            objects: parsed.objects,
            operations: parsed.operations || [],
            templates: parsed.postprocessorTemplates || DEFAULT_TEMPLATES,
            selectedObjectId: null,
            selectedOperationId: null,
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
        pushHistory(get());
        syncAndSave({
          projectName: extracted.name || fileName?.replace(/\.[^/.]+$/, '') || 'Проект_NcStudio',
          machine: { ...INITIAL_MACHINE, ...extracted.machine, controllerProfile: 'ncstudio' },
          objects: extracted.objects,
          operations: extracted.operations || [],
          templates: extracted.postprocessorTemplates || DEFAULT_TEMPLATES,
          selectedObjectId: null,
          selectedOperationId: null,
        });
        return true;
      }

      // 2. Process as raw NC Studio G-code file
      const parsedSegments = parseGcodeToSegments(fileContent);
      if (parsedSegments.length > 0) {
        pushHistory(get());
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
          feedCut: (obj as any).importedFeedCut || get().machine.feedCut || 1200,
          feedPlunge: (obj as any).importedFeedPlunge || get().machine.feedPlunge || 300,
          feedDrill: get().machine.feedDrill || 500,
          direction: 'cw',
        }));

        syncAndSave({
          projectName: cleanName,
          manualGcode: fileContent,
          objects: importedCadObjects.length > 0 ? importedCadObjects : get().objects,
          operations: newOps.length > 0 ? newOps : get().operations,
          selectedObjectId: null,
          selectedOperationId: null,
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

    undo: () => {
      const undoStack = get().historyUndo;
      if (undoStack.length === 0) return;

      const previous = undoStack[undoStack.length - 1];
      const newUndo = undoStack.slice(0, undoStack.length - 1);

      const currentSnapshot: HistoryState = {
        objects: JSON.parse(JSON.stringify(get().objects)),
        operations: JSON.parse(JSON.stringify(get().operations)),
        machine: JSON.parse(JSON.stringify(get().machine)),
      };

      set({
        objects: previous.objects,
        operations: previous.operations,
        machine: previous.machine,
        historyUndo: newUndo,
        historyRedo: [currentSnapshot, ...get().historyRedo],
      });

      get().regenerateGcode();
    },

    redo: () => {
      const redoStack = get().historyRedo;
      if (redoStack.length === 0) return;

      const next = redoStack[0];
      const newRedo = redoStack.slice(1);

      const currentSnapshot: HistoryState = {
        objects: JSON.parse(JSON.stringify(get().objects)),
        operations: JSON.parse(JSON.stringify(get().operations)),
        machine: JSON.parse(JSON.stringify(get().machine)),
      };

      set({
        objects: next.objects,
        operations: next.operations,
        machine: next.machine,
        historyUndo: [...get().historyUndo, currentSnapshot],
        historyRedo: newRedo,
      });

      get().regenerateGcode();
    },
  };
});

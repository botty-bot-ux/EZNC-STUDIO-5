import { OperationItem, ProjectData } from '../../types';
import {
  extractProjectDataFromNC,
  parseGcodeToCadObjects,
  parseGcodeToSegments,
} from '../../lib/gcode/parser';
import { DEFAULT_TEMPLATES } from '../../lib/postprocessor/templates';
import {
  INITIAL_MACHINE,
  DEFAULT_UNDERLAY,
  PROJECT_MODE_PRESETS,
  ProjectMode,
} from '../initialState';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез жизненного цикла проекта: имя, «новый проект» по пресету режима,
 * загрузка из JSON и из NC/G-код-файла (с восстановлением вложенного проекта).
 */
export function createProjectSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  'setProjectName' | 'newProject' | 'loadProjectJSON' | 'loadProjectNC'
> {
  const { get, pushHistory, syncAndSave } = ctx;

  return {
    setProjectName: (name: string) => syncAndSave({ projectName: name }),

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
  };
}

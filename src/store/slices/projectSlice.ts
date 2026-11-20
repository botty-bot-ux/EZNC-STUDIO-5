import { CADObject, NewCADObjectInput, ProjectData } from '../../types';
import {
  extractProjectDataFromNC,
  parseGcodeToCadObjects,
  parseGcodeToSegments,
} from '../../lib/gcode/parser';
import { DEFAULT_TEMPLATES } from '../../lib/postprocessor/templates';
import { createObjectId } from '../../lib/utils/id';
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
  'setProjectName' | 'newProject' | 'loadProjectJSON' | 'loadProjectNC' | 'importVectorObjects'
> {
  const { get, pushHistory, syncAndSave } = ctx;

  return {
    setProjectName: (name: string) => syncAndSave({ projectName: name }),

    newProject: (mode: ProjectMode, options) => {
      pushHistory();
      const baseMachine = structuredClone(PROJECT_MODE_PRESETS[mode]);
      const nextBounds = options?.bounds
        ? { ...baseMachine.bounds, ...options.bounds }
        : baseMachine.bounds;
      const nextStockSheet = options?.stockSheet
        ? {
            enabled: true,
            preset: 'custom' as const,
            widthX: 1081,
            widthY: 1681,
            color: '#22c55e',
            ...baseMachine.stockSheet,
            ...options.stockSheet,
          }
        : baseMachine.stockSheet;

      syncAndSave({
        projectName: 'Новый_Проект_ЧПУ',
        // Режим, выбранный при создании: свой лист, границы стола и фреза.
        machine: {
          ...baseMachine,
          bounds: nextBounds,
          stockSheet: nextStockSheet,
        },
        objects: [],
        manualGcodeDirty: false,
        selectedObjectIds: [],
        underlay: DEFAULT_UNDERLAY,
        activeTool: 'select',
        canvasFitSeq: get().canvasFitSeq + 1,
      });
    },

    loadProjectJSON: (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as ProjectData;
        if (parsed && Array.isArray(parsed.objects)) {
          pushHistory();
          syncAndSave({
            projectName: parsed.name || 'Загруженный_Проект',
            machine: {
              ...INITIAL_MACHINE,
              ...parsed.machine,
              bounds: { ...INITIAL_MACHINE.bounds, ...parsed.machine?.bounds },
              controllerProfile: 'ncstudio',
            },
            objects: parsed.objects,
            templates: parsed.postprocessorTemplates || DEFAULT_TEMPLATES,
            manualGcodeDirty: false,
            selectedObjectIds: [],
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
          machine: {
            ...INITIAL_MACHINE,
            ...extracted.machine,
            bounds: { ...INITIAL_MACHINE.bounds, ...extracted.machine?.bounds },
            controllerProfile: 'ncstudio',
          },
          objects: extracted.objects,
          templates: extracted.postprocessorTemplates || DEFAULT_TEMPLATES,
          manualGcodeDirty: false,
          selectedObjectIds: [],
          underlay: DEFAULT_UNDERLAY,
        });
        return true;
      }

      // 2. Process as raw NC Studio G-code file
      const parsedSegments = parseGcodeToSegments(fileContent);
      if (parsedSegments.length > 0) {
        pushHistory();
        const importedCadObjects = parseGcodeToCadObjects(
          fileContent,
          [],
          get().machine.workOffset
        );
        const cleanName = fileName?.replace(/\.[^/.]+$/, '') || 'Импортированная_Программа_NC';

        syncAndSave({
          projectName: cleanName,
          manualGcode: fileContent,
          manualGcodeDirty: true,
          objects: importedCadObjects.length > 0 ? importedCadObjects : get().objects,
          selectedObjectIds: [],
          underlay: DEFAULT_UNDERLAY,
          viewMode: 'preview',
        });

        return true;
      }

      return false;
    },

    importVectorObjects: (
      rawObjs: NewCADObjectInput[],
      mode: 'append' | 'replace',
      suggestedName?: string
    ) => {
      if (rawObjs.length === 0) return;
      pushHistory();
      const created: CADObject[] = rawObjs.map((raw) => ({
        ...raw,
        id: raw.id || createObjectId('imp'),
      })) as CADObject[];
      const newIds = created.map((o) => o.id);

      if (mode === 'replace') {
        syncAndSave({
          ...(suggestedName ? { projectName: suggestedName } : {}),
          objects: created,
          manualGcodeDirty: false,
          selectedObjectIds: newIds,
          underlay: DEFAULT_UNDERLAY,
          activeTool: 'select',
        });
        return;
      }

      syncAndSave({
        objects: [...get().objects, ...created],
        selectedObjectIds: newIds,
        activeTool: 'select',
      });
    },
  };
}

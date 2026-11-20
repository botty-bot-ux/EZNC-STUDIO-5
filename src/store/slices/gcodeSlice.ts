import { ProjectData } from '../../types';
import { generateGcode } from '../../lib/gcode/generator';
import {
  extractProjectDataFromNC,
  parseGcodeToCadObjects,
  parseGcodeToSegments,
} from '../../lib/gcode/parser';
import { OBJECT_MARKER_LINE_RE } from '../../lib/gcode/constants';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез G-кода: ручное редактирование, обратный парсинг в CAD-объекты, принудительная
 * регенерация и экспорт. Экспорт вычищает метаданные проекта и per-object комментарии,
 * оставляя на выходе только машинный код.
 */
export function createGcodeSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  'updateManualGcode' | 'parseManualGcode' | 'regenerateGcode' | 'exportProjectJSON' | 'exportGcode'
> {
  const { set, get, pushHistory, syncAndSave } = ctx;

  return {
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
          manualGcodeDirty: false,
          viewMode: 'preview',
        });
        return;
      }

      const existingObjs = get().objects;
      const updatedCadObjects = parseGcodeToCadObjects(
        gcode,
        existingObjs,
        get().machine.workOffset
      );

      if (updatedCadObjects.length > 0) {
        pushHistory();
        syncAndSave({
          objects: updatedCadObjects,
          manualGcodeDirty: false,
          viewMode: 'preview',
        });
      } else {
        set({ toolpathSegments: segs, viewMode: 'preview' });
      }
    },

    regenerateGcode: () => {
      const { objects, machine, templates } = get();
      const res = generateGcode(objects, [], machine, templates);
      set({
        generatedGcode: res.gcode,
        manualGcode: res.gcode,
        manualGcodeDirty: false,
        toolpathSegments: res.segments,
      });
    },

    exportProjectJSON: () => {
      const exportData: ProjectData = {
        version: '1.0',
        name: get().projectName,
        machine: { ...get().machine, controllerProfile: 'ncstudio' },
        objects: get().objects,
        operations: [],
        postprocessorTemplates: get().templates,
      };
      return JSON.stringify(exportData, null, 2);
    },

    // Clean G-code for the machine — no embedded "; NCSTUDIO_PROJECT" metadata and no
    // per-object ";[ID: ...]" comment headers (those stay only in the editor/preview G-code).
    exportGcode: () => {
      const gcode = get().manualGcodeDirty
        ? get().manualGcode
        : get().generatedGcode || get().manualGcode;
      return gcode
        .split('\n')
        .filter((line) => !OBJECT_MARKER_LINE_RE.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimStart();
    },
  };
}

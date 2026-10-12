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
  };
}

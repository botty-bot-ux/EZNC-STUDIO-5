import { CADObject, NewCADObjectInput } from '../../types';
import { optimizeCADObjects } from '../../lib/geometry/optimizer';
import { translateCADObject } from '../../lib/geometry/transform';
import { createObjectId } from '../../lib/utils/id';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез CRUD-операций над CAD-объектами: добавление, правка, удаление, дублирование,
 * порядок обхода, оптимизация маршрута и буфер обмена (Ctrl+C / Ctrl+V).
 */
export function createObjectsCrudSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  | 'reorderObjects'
  | 'optimizeRoute'
  | 'addObject'
  | 'addObjectsBulk'
  | 'recordHistory'
  | 'updateObject'
  | 'updateSelectedObjects'
  | 'updateObjectsBulk'
  | 'deleteObject'
  | 'deleteSelectedObjects'
  | 'duplicateObject'
  | 'copySelectedObjects'
  | 'pasteClipboard'
> {
  const { set, get, pushHistory, pushHistoryCoalesced, syncAndSave } = ctx;

  return {
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

      syncAndSave({
        objects: res.optimizedObjects,
      });

      return res;
    },

    addObject: (rawObj: NewCADObjectInput) => {
      pushHistory();
      const newObj: CADObject = {
        ...rawObj,
        id: rawObj.id || createObjectId(),
      } as CADObject;

      syncAndSave({
        objects: [...get().objects, newObj],
        selectedObjectIds: [newObj.id],
      });
    },

    addObjectsBulk: (rawObjs: NewCADObjectInput[]) => {
      if (rawObjs.length === 0) return;
      pushHistory();
      const created: CADObject[] = rawObjs.map((rawObj) => ({
        ...rawObj,
        id: rawObj.id || createObjectId(),
      })) as CADObject[];

      const newIds = created.map((o) => o.id);
      syncAndSave({
        objects: [...get().objects, ...created],
        selectedObjectIds: newIds,
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
      const remainingSelected = curIds.filter((i) => i !== id);
      syncAndSave({
        objects: newObjs,
        selectedObjectIds: remainingSelected,
      });
    },

    deleteSelectedObjects: () => {
      const ids = get().selectedObjectIds;
      if (ids.length === 0) return;

      pushHistory();
      const idSet = new Set(ids);
      const newObjs = get().objects.filter((o) => !idSet.has(o.id));

      syncAndSave({
        objects: newObjs,
        selectedObjectIds: [],
      });
    },

    duplicateObject: (id: string) => {
      const target = get().objects.find((o) => o.id === id);
      if (!target) return;

      pushHistory();
      const copy = translateCADObject(target, 10, 10);
      copy.id = createObjectId('dup');
      copy.name = `${target.name} (копия)`;

      syncAndSave({
        objects: [...get().objects, copy],
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
    // чтобы копии не ложились друг на друга. Вставленные фигуры разблокированы (frozen=false).
    pasteClipboard: () => {
      const clip = get().clipboard;
      if (!clip || clip.length === 0) return;

      const seq = get().clipboardSeq + 1;
      const off = 15 * seq;
      const newObjs: CADObject[] = clip.map((src) => {
        const copy = translateCADObject(src, off, off);
        copy.id = createObjectId('paste');
        copy.name = `${src.name} (копия)`;
        copy.frozen = false;
        return copy;
      });

      pushHistory();
      syncAndSave({
        objects: [...get().objects, ...newObjs],
        clipboardSeq: seq,
        selectedObjectIds: newObjs.map((o) => o.id),
      });
    },
  };
}

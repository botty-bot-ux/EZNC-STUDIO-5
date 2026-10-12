import {
  CADObject,
  MachineSettings,
  NewCADObjectInput,
  OperationItem,
  Point2D,
} from '../../types';
import { optimizeCADObjects } from '../../lib/geometry/optimizer';
import { scaleCADObject, translateCADObject } from '../../lib/geometry/transform';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез фигур: изменение станка, построение/обновление/удаление/дублирование фигур,
 * оптимизация маршрута, групповое копирование/вставка и точное перемещение/масштабирование.
 * Каждое содержательное изменение пишет один шаг истории и пересобирает G-код через syncAndSave.
 */
export function createObjectsSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  | 'updateMachine'
  | 'reorderObjects'
  | 'optimizeRoute'
  | 'addObject'
  | 'recordHistory'
  | 'updateObject'
  | 'updateSelectedObjects'
  | 'updateObjectsBulk'
  | 'deleteObject'
  | 'deleteSelectedObjects'
  | 'duplicateObject'
  | 'copySelectedObjects'
  | 'pasteClipboard'
  | 'moveSelectedObjectsBy'
  | 'scaleSelectedObjectsBy'
> {
  const { set, get, pushHistory, pushHistoryCoalesced, syncAndSave } = ctx;

  return {
    updateMachine: (partial: Partial<MachineSettings>) => {
      pushHistoryCoalesced(`machine:${Object.keys(partial).sort().join('+')}`);
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
      // ВАЖНО: ops — поверхностная копия, поэтому ops[0] перезаписываем НОВЫМ объектом
      // с новым массивом linkedObjectIds. Push прямо в ops[0].linkedObjectIds мутировал
      // бы массив, разделяемый с состоянием стора и снапшотами истории.
      let ops = [...get().operations];
      if (ops.length > 0) {
        ops[0] = { ...ops[0], linkedObjectIds: [...ops[0].linkedObjectIds, newObj.id] };
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
        selectedObjectIds: [newObj.id],
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
      const newOps = get().operations.map((op) => ({
        ...op,
        linkedObjectIds: op.linkedObjectIds.filter((objId) => objId !== id),
      }));
      const remainingSelected = curIds.filter((i) => i !== id);
      syncAndSave({
        objects: newObjs,
        operations: newOps,
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
    // чтобы копии не ложились друг на друга. Вставленные фигуры разблокированы
    // (frozen=false), получают новые id и связываются с теми же операциями, что и оригиналы.
    pasteClipboard: () => {
      const clip = get().clipboard;
      if (!clip || clip.length === 0) return;

      const seq = get().clipboardSeq + 1;
      const off = 15 * seq;
      const ts = Date.now();
      const idMap = new Map<string, string>();
      const newObjs: CADObject[] = clip.map((src, i) => {
        const copy = translateCADObject(src, off, off);
        const newId = `obj_${ts}_${Math.random().toString(36).substring(2, 7)}_${i}`;
        idMap.set(src.id, newId);
        copy.id = newId;
        copy.name = `${src.name} (копия)`;
        copy.frozen = false;
        return copy;
      });

      const newOps = get().operations.map((op) => {
        const additions = op.linkedObjectIds
          .filter((lid) => idMap.has(lid))
          .map((lid) => idMap.get(lid)!);
        if (additions.length === 0) return op;
        return { ...op, linkedObjectIds: [...op.linkedObjectIds, ...additions] };
      });

      pushHistory();
      syncAndSave({
        objects: [...get().objects, ...newObjs],
        operations: newOps,
        clipboardSeq: seq,
        selectedObjectIds: newObjs.map((o) => o.id),
      });
    },

    // Точное перемещение всего выделения на сдвиг (dx, dy) мм относительно текущего
    // положения. id сохраняются — фигуры просто едут; одна запись истории, пересчёт G-кода.
    moveSelectedObjectsBy: (dx: number, dy: number) => {
      const movable = new Set(
        get().objects.filter((o) => o.frozen !== true).map((o) => o.id)
      );
      const ids = new Set(get().selectedObjectIds.filter((id) => movable.has(id)));
      if (ids.size === 0) return;
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
      pushHistory();
      const newObjs = get().objects.map((o) => (ids.has(o.id) ? translateCADObject(o, dx, dy) : o));
      syncAndSave({ objects: newObjs });
    },

    // Точное растяжение всего выделения относительно якоря (обычно — центр рамки
    // выделения). Замороженные фигуры не трогаются; sx/sy близкие к 1 игнорируются.
    // Одна запись истории, пересчёт G-кода.
    scaleSelectedObjectsBy: (anchor: Point2D, sx: number, sy: number) => {
      const movable = new Set(
        get().objects.filter((o) => o.frozen !== true).map((o) => o.id)
      );
      const ids = new Set(get().selectedObjectIds.filter((id) => movable.has(id)));
      if (ids.size === 0) return;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
      if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return;
      pushHistory();
      const newObjs = get().objects.map((o) =>
        ids.has(o.id) ? scaleCADObject(o, anchor, sx, sy) : o
      );
      syncAndSave({ objects: newObjs });
    },
  };
}

import { AlignMode, CADObject, Point2D, StockAlignMode } from '../../types';
import {
  computeObjectBounds,
  computeObjectsBounds,
  mirrorCADObject,
  rotateCADObject,
  rotateCADObject90,
  scaleCADObject,
  translateCADObject,
} from '../../lib/geometry/transform';
import {
  computeStockAlignmentDelta,
  computeTrimOperation,
  computeTwoLineFillet,
  joinSelectedContours,
} from '../../lib/geometry/cadOps';
import { createObjectId } from '../../lib/utils/id';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез геометрических трансформаций и CAD-операций: перемещение, масштабирование,
 * зеркалирование, поворот, выравнивание, объединение контуров, обрезка (ножницы),
 * скругление (углы / два отрезка) и массив копий.
 */
export function createObjectsTransformSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  | 'moveSelectedObjectsBy'
  | 'scaleSelectedObjectsBy'
  | 'mirrorSelectedObjects'
  | 'rotateSelectedObjects'
  | 'rotateSelectedObjectsByAngle'
  | 'alignSelectedObjects'
  | 'alignSelectedObjectsToStock'
  | 'joinSelectedObjects'
  | 'trimObjectAtPoint'
  | 'filletLines'
  | 'filletRectangle'
  | 'arraySelectedObjects'
> {
  const { get, pushHistory, syncAndSave } = ctx;

  const getSelectedMovable = (): CADObject[] => {
    const selectedSet = new Set(get().selectedObjectIds);
    return get().objects.filter((o) => selectedSet.has(o.id) && o.frozen !== true);
  };

  return {
    moveSelectedObjectsBy: (dx: number, dy: number) => {
      const movable = getSelectedMovable();
      if (movable.length === 0) return;
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
      const ids = new Set(movable.map((o) => o.id));
      pushHistory();
      const newObjs = get().objects.map((o) => (ids.has(o.id) ? translateCADObject(o, dx, dy) : o));
      syncAndSave({ objects: newObjs });
    },

    scaleSelectedObjectsBy: (anchor: Point2D, sx: number, sy: number) => {
      const movable = getSelectedMovable();
      if (movable.length === 0) return;
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx === 0 || sy === 0) return;
      if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return;
      const ids = new Set(movable.map((o) => o.id));
      pushHistory();
      const newObjs = get().objects.map((o) =>
        ids.has(o.id) ? scaleCADObject(o, anchor, sx, sy) : o
      );
      syncAndSave({ objects: newObjs });
    },

    mirrorSelectedObjects: (axis: 'x' | 'y') => {
      const movable = getSelectedMovable();
      const bounds = computeObjectsBounds(movable);
      if (!bounds || movable.length === 0) return;
      const anchor = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const movableIds = new Set(movable.map((o) => o.id));
      pushHistory();
      const newObjs = get().objects.map((o) =>
        movableIds.has(o.id) ? mirrorCADObject(o, axis, anchor) : o
      );
      syncAndSave({ objects: newObjs });
    },

    rotateSelectedObjects: (angleDeg: 90 | -90 | 180) => {
      const movable = getSelectedMovable();
      const bounds = computeObjectsBounds(movable);
      if (!bounds || movable.length === 0) return;
      const anchor = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const movableIds = new Set(movable.map((o) => o.id));
      pushHistory();
      const newObjs = get().objects.map((o) =>
        movableIds.has(o.id) ? rotateCADObject90(o, angleDeg, anchor) : o
      );
      syncAndSave({ objects: newObjs });
    },

    rotateSelectedObjectsByAngle: (angleDeg: number, anchorMode: 'selection' | 'origin') => {
      if (!Number.isFinite(angleDeg) || Math.abs(angleDeg) < 1e-6) return;
      const movable = getSelectedMovable();
      if (movable.length === 0) return;
      const bounds = computeObjectsBounds(movable);
      if (!bounds) return;
      const anchor =
        anchorMode === 'origin'
          ? { x: 0, y: 0 }
          : { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
      const movableIds = new Set(movable.map((o) => o.id));
      pushHistory();
      const newObjs = get().objects.map((o) =>
        movableIds.has(o.id) ? rotateCADObject(o, angleDeg, anchor) : o
      );
      syncAndSave({ objects: newObjs });
    },

    alignSelectedObjects: (mode: AlignMode) => {
      const selectedSet = new Set(get().selectedObjectIds);
      const selected = get().objects.filter((o) => selectedSet.has(o.id));
      if (selected.length < 2) return;
      const groupBounds = computeObjectsBounds(selected);
      if (!groupBounds) return;

      const movableIds = new Set(selected.filter((o) => o.frozen !== true).map((o) => o.id));
      if (movableIds.size === 0) return;

      const groupCenterX = (groupBounds.minX + groupBounds.maxX) / 2;
      const groupCenterY = (groupBounds.minY + groupBounds.maxY) / 2;

      pushHistory();
      const newObjs = get().objects.map((o) => {
        if (!movableIds.has(o.id)) return o;
        const b = computeObjectBounds(o);
        let dx = 0;
        let dy = 0;
        switch (mode) {
          case 'screenLeft':
            dy = groupBounds.minY - b.minY;
            break;
          case 'screenRight':
            dy = groupBounds.maxY - b.maxY;
            break;
          case 'screenCenterH':
            dy = groupCenterY - (b.minY + b.maxY) / 2;
            break;
          case 'screenTop':
            dx = groupBounds.minX - b.minX;
            break;
          case 'screenBottom':
            dx = groupBounds.maxX - b.maxX;
            break;
          case 'screenCenterV':
            dx = groupCenterX - (b.minX + b.maxX) / 2;
            break;
        }
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return o;
        return translateCADObject(o, dx, dy);
      });
      syncAndSave({ objects: newObjs });
    },

    alignSelectedObjectsToStock: (mode: StockAlignMode, marginMm: number = 0) => {
      const selectedSet = new Set(get().selectedObjectIds);
      const selected = get().objects.filter((o) => selectedSet.has(o.id));
      if (selected.length === 0) return;
      const delta = computeStockAlignmentDelta(
        selected,
        get().machine.stockSheet,
        mode,
        Number.isFinite(marginMm) ? marginMm : 0
      );
      if (!delta || (Math.abs(delta.dx) < 1e-6 && Math.abs(delta.dy) < 1e-6)) return;
      const movableIds = new Set(selected.filter((o) => o.frozen !== true).map((o) => o.id));
      if (movableIds.size === 0) return;
      pushHistory();
      const newObjs = get().objects.map((o) =>
        movableIds.has(o.id) ? translateCADObject(o, delta.dx, delta.dy) : o
      );
      syncAndSave({ objects: newObjs });
    },

    joinSelectedObjects: () => {
      const selectedSet = new Set(get().selectedObjectIds);
      const selected = get().objects.filter((o) => selectedSet.has(o.id));
      const res = joinSelectedContours(selected, 0.5);
      if (res.consumedIds.length === 0 || res.joinedPolylines.length === 0) return 0;

      pushHistory();
      const created: CADObject[] = res.joinedPolylines.map((raw) => ({
        ...raw,
        id: createObjectId('join'),
      })) as CADObject[];
      const newIds = created.map((o) => o.id);
      const consumedSet = new Set(res.consumedIds);

      const newObjs: CADObject[] = [];
      let inserted = false;
      for (const o of get().objects) {
        if (consumedSet.has(o.id)) {
          if (!inserted) {
            newObjs.push(...created);
            inserted = true;
          }
          continue;
        }
        newObjs.push(o);
      }
      if (!inserted) newObjs.push(...created);

      const remainingSel = get().selectedObjectIds.filter((id) => !consumedSet.has(id));
      syncAndSave({
        objects: newObjs,
        selectedObjectIds: [...remainingSel, ...newIds],
      });
      return res.joinedSourceCount;
    },

    trimObjectAtPoint: (objectId: string, worldPt: Point2D) => {
      const allObjs = get().objects;
      const target = allObjs.find((o) => o.id === objectId);
      if (!target) return false;
      const res = computeTrimOperation(target, worldPt, allObjs);
      if (!res) return false;

      pushHistory();
      const created: CADObject[] = res.replacements.map((raw) => ({
        ...raw,
        id: createObjectId('trim'),
      })) as CADObject[];
      const newIds = created.map((o) => o.id);

      const newObjs: CADObject[] = [];
      for (const o of allObjs) {
        if (o.id === objectId) {
          newObjs.push(...created);
        } else {
          newObjs.push(o);
        }
      }

      const curSel = get().selectedObjectIds;
      const nextSel = curSel.includes(objectId)
        ? [...curSel.filter((id) => id !== objectId), ...newIds]
        : curSel;

      syncAndSave({
        objects: newObjs,
        selectedObjectIds: nextSel,
      });
      return true;
    },

    filletLines: (idA, idB, radius, clickA, clickB) => {
      if (idA === idB) return { ok: false, reason: 'Выберите два разных отрезка' };
      const allObjs = get().objects;
      const l1 = allObjs.find((o) => o.id === idA);
      const l2 = allObjs.find((o) => o.id === idB);
      if (!l1 || !l2 || l1.type !== 'line' || l2.type !== 'line') {
        return { ok: false, reason: 'Скругление работает между двумя отрезками' };
      }
      if (l1.frozen || l2.frozen) {
        return { ok: false, reason: 'Один из отрезков зафиксирован' };
      }

      const outcome = computeTwoLineFillet(l1, l2, radius, clickA, clickB);
      if (!outcome.ok) return { ok: false, reason: outcome.reason };

      pushHistory();
      const arcObj: CADObject = {
        id: createObjectId('fillet'),
        name: `Скругление R${Number(radius.toFixed(1))}`,
        type: 'arc',
        ...outcome.result.arc,
        depth: l1.depth,
        operationType: l1.operationType,
        color: l1.color,
        visible: l1.visible,
      };

      const newObjs: CADObject[] = [];
      for (const o of allObjs) {
        if (o.id === idA) {
          newObjs.push({ ...o, ...outcome.result.lineA } as CADObject);
          newObjs.push(arcObj);
        } else if (o.id === idB) {
          newObjs.push({ ...o, ...outcome.result.lineB } as CADObject);
        } else {
          newObjs.push(o);
        }
      }

      syncAndSave({
        objects: newObjs,
        selectedObjectIds: [arcObj.id],
      });
      return { ok: true };
    },

    filletRectangle: (id, radius) => {
      const target = get().objects.find((o) => o.id === id);
      if (!target || target.type !== 'rectangle') {
        return { ok: false, reason: 'Фигура не является прямоугольником' };
      }
      if (target.frozen) {
        return { ok: false, reason: 'Прямоугольник зафиксирован' };
      }
      const maxR = Math.min(target.width, target.height) / 2;
      if (radius < 0) return { ok: false, reason: 'Радиус не может быть отрицательным' };
      if (radius > maxR + 1e-4) {
        return {
          ok: false,
          reason: `Радиус ${radius} мм велик (макс. ${maxR.toFixed(1)} мм для ${target.width.toFixed(0)}×${target.height.toFixed(0)})`,
        };
      }
      pushHistory();
      const newObjs = get().objects.map((o) =>
        o.id === id ? ({ ...o, cornerRadius: radius } as CADObject) : o
      );
      syncAndSave({
        objects: newObjs,
        selectedObjectIds: [id],
      });
      return { ok: true };
    },

    arraySelectedObjects: (countX: number, stepX: number, countY: number, stepY: number) => {
      const nx = Math.max(1, Math.min(50, Math.round(countX)));
      const ny = Math.max(1, Math.min(50, Math.round(countY)));
      if (nx === 1 && ny === 1) return;
      if (!Number.isFinite(stepX) || !Number.isFinite(stepY)) return;

      const selectedSet = new Set(get().selectedObjectIds);
      const sources = get().objects.filter((o) => selectedSet.has(o.id));
      if (sources.length === 0) return;

      const created: CADObject[] = [];
      for (let ix = 0; ix < nx; ix++) {
        for (let iy = 0; iy < ny; iy++) {
          if (ix === 0 && iy === 0) continue;
          const dx = ix * stepX;
          const dy = iy * stepY;
          for (const src of sources) {
            const copy = translateCADObject(src, dx, dy);
            copy.id = createObjectId('arr');
            copy.frozen = false;
            created.push(copy);
          }
        }
      }

      if (created.length === 0) return;

      pushHistory();
      syncAndSave({
        objects: [...get().objects, ...created],
        selectedObjectIds: [...get().selectedObjectIds, ...created.map((o) => o.id)],
      });
    },
  };
}

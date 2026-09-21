import { CADObject, MachineSettings, Point2D } from '../../types';
import { SnapPointInfo, applyGridSnap, worldToCanvas } from './canvasUtils';

export type DragMode =
  | 'none'
  | 'pan'
  | 'object'
  | 'selection_box'
  | 'line_start'
  | 'line_end'
  | 'polyline_point'
  | 'arc_start'
  | 'arc_end'
  | 'arc_center';

// Subset of DragMode that represents a specific draggable geometry handle.
export type HandleType = Extract<
  DragMode,
  'line_start' | 'line_end' | 'polyline_point' | 'arc_start' | 'arc_end' | 'arc_center'
>;

/**
 * Finds handle hit (line start/end, arc start/end/center) near mouse point.
 *
 * `selectedIds` — массив id выделенных фигур. Если он задан и непуст, грифы этих
 * фигур имеют приоритет (возвращается ближайший из них), и только если среди
 * выделенных совпадения нет — ищем по всем видимым. Так можно схватить узел, когда
 * группа из нескольких фигур уже выделена, и не потерять выделение.
 */
export function findHandleHit(
  objects: CADObject[],
  selectedIds: string[] | null | undefined,
  mousePx: Point2D,
  pan: Point2D,
  zoom: number,
  handleHitRadiusPx: number = 14
): { objectId: string; type: HandleType } | null {
  const wToC = (x: number, y: number) => worldToCanvas(x, y, pan, zoom);
  const selSet = new Set(selectedIds ?? []);

  let bestSelected: { objectId: string; type: HandleType; dist: number } | null = null;
  let bestAny: { objectId: string; type: HandleType; dist: number } | null = null;

  for (const obj of objects) {
    if (obj.visible === false || obj.frozen) continue;
    const candidates: { type: HandleType; x: number; y: number }[] = [];
    if (obj.type === 'line') {
      candidates.push({ type: 'line_start', x: obj.startX, y: obj.startY });
      candidates.push({ type: 'line_end', x: obj.endX, y: obj.endY });
    } else if (obj.type === 'arc') {
      candidates.push({ type: 'arc_start', x: obj.startX, y: obj.startY });
      candidates.push({ type: 'arc_end', x: obj.endX, y: obj.endY });
      candidates.push({ type: 'arc_center', x: obj.centerX, y: obj.centerY });
    } else {
      continue;
    }
    for (const c of candidates) {
      const p = wToC(c.x, c.y);
      const d = Math.hypot(p.x - mousePx.x, p.y - mousePx.y);
      if (d > handleHitRadiusPx) continue;
      if (selSet.has(obj.id)) {
        if (!bestSelected || d < bestSelected.dist) {
          bestSelected = { objectId: obj.id, type: c.type, dist: d };
        }
      } else if (!bestAny || d < bestAny.dist) {
        bestAny = { objectId: obj.id, type: c.type, dist: d };
      }
    }
  }

  return bestSelected ?? bestAny;
}

/** Кратчайшее расстояние точка → отрезок (перпендикуляр с «зажимом» внутрь сегмента). */
function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Лежит ли направление из центра дуги в точку p внутри её охвата (по направлению обхода). */
function angleInArcSweep(arc: { startX: number; startY: number; endX: number; endY: number; centerX: number; centerY: number; clockwise: boolean }, p: Point2D): boolean {
  const TAU = Math.PI * 2;
  const norm = (x: number) => ((x % TAU) + TAU) % TAU;
  const a0 = Math.atan2(arc.startY - arc.centerY, arc.startX - arc.centerX);
  const a1 = Math.atan2(arc.endY - arc.centerY, arc.endX - arc.centerX);
  const t = Math.atan2(p.y - arc.centerY, p.x - arc.centerX);
  const EPS_SWEEP = 1e-9;
  if (arc.clockwise) return norm(a0 - t) <= norm(a0 - a1) + EPS_SWEEP;
  return norm(t - a0) <= norm(a1 - a0) + EPS_SWEEP;
}

/**
 * Finds CAD object hit by clicking/hovering on its body.
 */
export function findObjectBodyHit(
  objects: CADObject[],
  rawWorldPt: Point2D,
  zoom: number
): string | null {
  const hitTolerance = 12 / zoom;

  for (const obj of objects) {
    if (obj.visible === false) continue;
    if (obj.type === 'point') {
      const dist = Math.hypot(rawWorldPt.x - obj.x, rawWorldPt.y - obj.y);
      if (dist <= Math.max(obj.diameter / 2, hitTolerance)) {
        return obj.id;
      }
    } else if (obj.type === 'rectangle') {
      if (
        rawWorldPt.x >= obj.x - hitTolerance &&
        rawWorldPt.x <= obj.x + obj.width + hitTolerance &&
        rawWorldPt.y >= obj.y - hitTolerance &&
        rawWorldPt.y <= obj.y + obj.height + hitTolerance
      ) {
        return obj.id;
      }
    } else if (obj.type === 'circle') {
      const dist = Math.hypot(rawWorldPt.x - obj.centerX, rawWorldPt.y - obj.centerY);
      if (Math.abs(dist - obj.radius) <= hitTolerance || dist <= obj.radius) {
        return obj.id;
      }
    } else if (obj.type === 'line') {
      // Раньше стояла проверка «d1+d2 ≈ длина» — это эллипс вокруг отрезка, из-за чего
      // линия «чувствовалась» за десятки мм в стороне. Теперь честное расстояние до
      // самого сегмента: зона сопоставима с концевыми точками (12px против 14px у грифа).
      const d = distanceToSegment(
        rawWorldPt,
        { x: obj.startX, y: obj.startY },
        { x: obj.endX, y: obj.endY }
      );
      if (d <= hitTolerance) {
        return obj.id;
      }
    } else if (obj.type === 'arc') {
      const dist = Math.hypot(rawWorldPt.x - obj.centerX, rawWorldPt.y - obj.centerY);
      // Кольцо радиуса + угол внутри охвата дуги: без проверки угла срабатывало
      // на ВСЮ окружность «сыра», а не на свой сектор.
      if (
        Math.abs(dist - obj.radius) <= hitTolerance &&
        angleInArcSweep(obj, rawWorldPt)
      ) {
        return obj.id;
      }
    }
  }

  return null;
}

/**
 * Smart Object Snapping (O-SNAP to line endpoints, hole centers, circle centers, etc.)
 */
export function findMagneticSnapPoint(
  rawWorldPt: Point2D,
  mousePx: Point2D,
  objects: CADObject[],
  objectSnapEnabled: boolean,
  snapToGrid: boolean,
  gridStep: number,
  pan: Point2D,
  zoom: number,
  excludeObjectId?: string,
  excludeHandleType?: DragMode,
  machine?: MachineSettings
): { point: Point2D; snapInfo: SnapPointInfo | null } {
  if (!objectSnapEnabled) {
    return { point: applyGridSnap(rawWorldPt, snapToGrid, gridStep), snapInfo: null };
  }

  const snapRadiusPx = 22;
  let closestSnap: SnapPointInfo | null = null;
  let minDistancePx = snapRadiusPx;

  // 1. Stock Sheet & Origin Snap Candidates
  const stock = machine?.stockSheet;
  if (stock && stock.enabled && stock.preset !== 'none' && stock.widthX > 0 && stock.widthY > 0) {
    const wX = stock.widthX;
    const wY = stock.widthY;

    const stockCandidates: { x: number; y: number; label: string; type: SnapPointInfo['type'] }[] = [
      { x: 0, y: 0, label: 'Угол заготовки (Ноль X:0 Y:0)', type: 'corner' },
      { x: -wX, y: 0, label: `Угол заготовки (X:-${wX} Y:0)`, type: 'corner' },
      { x: 0, y: -wY, label: `Угол заготовки (X:0 Y:-${wY})`, type: 'corner' },
      { x: -wX, y: -wY, label: `Дальний угол заготовки (-${wX}, -${wY})`, type: 'corner' },

      { x: -wX / 2, y: 0, label: 'Середина передней границы заготовки', type: 'midpoint' },
      { x: -wX / 2, y: -wY, label: 'Середина задней границы заготовки', type: 'midpoint' },
      { x: 0, y: -wY / 2, label: 'Середина правой границы заготовки', type: 'midpoint' },
      { x: -wX, y: -wY / 2, label: 'Середина левой границы заготовки', type: 'midpoint' },

      { x: -wX / 2, y: -wY / 2, label: `Центр заготовки (${wX}×${wY}мм)`, type: 'center' },
    ];

    for (const cand of stockCandidates) {
      const candPx = worldToCanvas(cand.x, cand.y, pan, zoom);
      const distPx = Math.hypot(candPx.x - mousePx.x, candPx.y - mousePx.y);

      if (distPx < minDistancePx) {
        minDistancePx = distPx;
        closestSnap = {
          ...cand,
          objectId: 'stock',
        };
      }
    }
  } else {
    // Zero Origin (0,0) Fallback Snap
    const zeroPx = worldToCanvas(0, 0, pan, zoom);
    const distZeroPx = Math.hypot(zeroPx.x - mousePx.x, zeroPx.y - mousePx.y);
    if (distZeroPx < minDistancePx) {
      minDistancePx = distZeroPx;
      closestSnap = {
        x: 0,
        y: 0,
        label: 'Ноль системы координат (0,0)',
        type: 'corner',
        objectId: 'origin',
      };
    }
  }

  // 2. CAD Objects Snap
  for (const obj of objects) {
    if (obj.visible === false) continue;

    const candidates: { x: number; y: number; label: string; type: SnapPointInfo['type'] }[] = [];

    if (obj.type === 'point') {
      candidates.push({
        x: obj.x,
        y: obj.y,
        label: `Центр отверстия (${obj.name || 'Ø11мм'})`,
        type: 'center',
      });
    } else if (obj.type === 'circle') {
      candidates.push({
        x: obj.centerX,
        y: obj.centerY,
        label: `Центр окружности R${obj.radius}`,
        type: 'center',
      });
    } else if (obj.type === 'line') {
      const isSameObj = obj.id === excludeObjectId;

      if (!isSameObj || excludeHandleType !== 'line_start') {
        candidates.push({
          x: obj.startX,
          y: obj.startY,
          label: 'Конец линии (Точка 1)',
          type: 'endpoint',
        });
      }
      if (!isSameObj || excludeHandleType !== 'line_end') {
        candidates.push({
          x: obj.endX,
          y: obj.endY,
          label: 'Конец линии (Точка 2)',
          type: 'endpoint',
        });
      }
      if (!isSameObj) {
        candidates.push({
          x: (obj.startX + obj.endX) / 2,
          y: (obj.startY + obj.endY) / 2,
          label: 'Середина линии',
          type: 'midpoint',
        });
      }
    } else if (obj.type === 'rectangle') {
      candidates.push(
        { x: obj.x, y: obj.y, label: 'Угол прямоугольника', type: 'corner' },
        { x: obj.x + obj.width, y: obj.y, label: 'Угол прямоугольника', type: 'corner' },
        { x: obj.x, y: obj.y + obj.height, label: 'Угол прямоугольника', type: 'corner' },
        { x: obj.x + obj.width, y: obj.y + obj.height, label: 'Угол прямоугольника', type: 'corner' },
        { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2, label: 'Центр прямоугольника', type: 'center' }
      );
    } else if (obj.type === 'polyline' && obj.points) {
      obj.points.forEach((p, idx) => {
        candidates.push({
          x: p.x,
          y: p.y,
          label: `Узел полилинии #${idx + 1}`,
          type: 'endpoint',
        });
      });
    } else if (obj.type === 'arc') {
      candidates.push(
        { x: obj.startX, y: obj.startY, label: 'Начало дуги (Точка 1)', type: 'endpoint' },
        { x: obj.endX, y: obj.endY, label: 'Конец дуги (Точка 2)', type: 'endpoint' },
        { x: obj.centerX, y: obj.centerY, label: `Центр дуги R${obj.radius}`, type: 'center' }
      );
    }

    for (const cand of candidates) {
      const candPx = worldToCanvas(cand.x, cand.y, pan, zoom);
      const distPx = Math.hypot(candPx.x - mousePx.x, candPx.y - mousePx.y);

      if (distPx < minDistancePx) {
        minDistancePx = distPx;
        closestSnap = {
          ...cand,
          objectId: obj.id,
        };
      }
    }
  }

  if (closestSnap) {
    return {
      point: { x: closestSnap.x, y: closestSnap.y },
      snapInfo: closestSnap,
    };
  }

  return {
    point: applyGridSnap(rawWorldPt, snapToGrid, gridStep),
    snapInfo: null,
  };
}

/**
 * Calculates world bounding box for a CAD object
 */
export function getObjectBoundingBox(obj: CADObject): { minX: number; maxX: number; minY: number; maxY: number } {
  if (obj.type === 'point') {
    const r = Math.max(obj.diameter / 2, 2);
    return { minX: obj.x - r, maxX: obj.x + r, minY: obj.y - r, maxY: obj.y + r };
  }
  if (obj.type === 'line') {
    return {
      minX: Math.min(obj.startX, obj.endX),
      maxX: Math.max(obj.startX, obj.endX),
      minY: Math.min(obj.startY, obj.endY),
      maxY: Math.max(obj.startY, obj.endY),
    };
  }
  if (obj.type === 'rectangle') {
    return {
      minX: Math.min(obj.x, obj.x + obj.width),
      maxX: Math.max(obj.x, obj.x + obj.width),
      minY: Math.min(obj.y, obj.y + obj.height),
      maxY: Math.max(obj.y, obj.y + obj.height),
    };
  }
  if (obj.type === 'circle') {
    return {
      minX: obj.centerX - obj.radius,
      maxX: obj.centerX + obj.radius,
      minY: obj.centerY - obj.radius,
      maxY: obj.centerY + obj.radius,
    };
  }
  if (obj.type === 'arc') {
    return {
      minX: Math.min(obj.startX, obj.endX, obj.centerX - obj.radius),
      maxX: Math.max(obj.startX, obj.endX, obj.centerX + obj.radius),
      minY: Math.min(obj.startY, obj.endY, obj.centerY - obj.radius),
      maxY: Math.max(obj.startY, obj.endY, obj.centerY + obj.radius),
    };
  }
  if (obj.type === 'polyline' && obj.points && obj.points.length > 0) {
    let minX = obj.points[0].x;
    let maxX = obj.points[0].x;
    let minY = obj.points[0].y;
    let maxY = obj.points[0].y;
    for (const p of obj.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  }
  return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
}

/**
 * Finds all visible objects whose bounding box overlaps or intersects with selection box bounds
 */
export function findObjectsInBox(
  objects: CADObject[],
  box: { minX: number; maxX: number; minY: number; maxY: number }
): string[] {
  const result: string[] = [];
  for (const obj of objects) {
    if (obj.visible === false) continue;
    const bb = getObjectBoundingBox(obj);
    if (bb.minX <= box.maxX && bb.maxX >= box.minX && bb.minY <= box.maxY && bb.maxY >= box.minY) {
      result.push(obj.id);
    }
  }
  return result;
}


import { CADObject, Point2D } from '../../types';
import {
  HoveredHandle,
  SnapPointInfo,
  applyGridSnap,
  worldToCanvas,
} from './canvasUtils';

export type DragMode =
  | 'none'
  | 'pan'
  | 'object'
  | 'line_start'
  | 'line_end'
  | 'polyline_point'
  | 'arc_start'
  | 'arc_end'
  | 'arc_center';

/**
 * Finds handle hit (line start/end, arc start/end/center) near mouse point.
 */
export function findHandleHit(
  objects: CADObject[],
  selectedObjectId: string | null,
  mousePx: Point2D,
  pan: Point2D,
  zoom: number,
  handleHitRadiusPx: number = 14
): { objectId: string; type: DragMode } | null {
  const wToC = (x: number, y: number) => worldToCanvas(x, y, pan, zoom);

  // 1. Prioritize selected object
  if (selectedObjectId) {
    const selObj = objects.find((o) => o.id === selectedObjectId);
    if (selObj && selObj.visible !== false) {
      if (selObj.type === 'line') {
        const p1 = wToC(selObj.startX, selObj.startY);
        const p2 = wToC(selObj.endX, selObj.endY);

        if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
          return { objectId: selObj.id, type: 'line_start' };
        }
        if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
          return { objectId: selObj.id, type: 'line_end' };
        }
      } else if (selObj.type === 'arc') {
        const p1 = wToC(selObj.startX, selObj.startY);
        const p2 = wToC(selObj.endX, selObj.endY);
        const cp = wToC(selObj.centerX, selObj.centerY);

        if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
          return { objectId: selObj.id, type: 'arc_start' };
        }
        if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
          return { objectId: selObj.id, type: 'arc_end' };
        }
        if (Math.hypot(mousePx.x - cp.x, mousePx.y - cp.y) <= handleHitRadiusPx) {
          return { objectId: selObj.id, type: 'arc_center' };
        }
      }
    }
  }

  // 2. Check all visible objects
  for (const obj of objects) {
    if (obj.visible === false) continue;
    if (obj.type === 'line') {
      const p1 = wToC(obj.startX, obj.startY);
      const p2 = wToC(obj.endX, obj.endY);

      if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
        return { objectId: obj.id, type: 'line_start' };
      }
      if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
        return { objectId: obj.id, type: 'line_end' };
      }
    } else if (obj.type === 'arc') {
      const p1 = wToC(obj.startX, obj.startY);
      const p2 = wToC(obj.endX, obj.endY);
      const cp = wToC(obj.centerX, obj.centerY);

      if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
        return { objectId: obj.id, type: 'arc_start' };
      }
      if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
        return { objectId: obj.id, type: 'arc_end' };
      }
      if (Math.hypot(mousePx.x - cp.x, mousePx.y - cp.y) <= handleHitRadiusPx) {
        return { objectId: obj.id, type: 'arc_center' };
      }
    }
  }

  return null;
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
      const d1 = Math.hypot(rawWorldPt.x - obj.startX, rawWorldPt.y - obj.startY);
      const d2 = Math.hypot(rawWorldPt.x - obj.endX, rawWorldPt.y - obj.endY);
      const lineLen = Math.hypot(obj.endX - obj.startX, obj.endY - obj.startY);
      if (d1 + d2 >= lineLen - hitTolerance && d1 + d2 <= lineLen + hitTolerance) {
        return obj.id;
      }
    } else if (obj.type === 'arc') {
      const dist = Math.hypot(rawWorldPt.x - obj.centerX, rawWorldPt.y - obj.centerY);
      if (Math.abs(dist - obj.radius) <= hitTolerance) {
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
  excludeHandleType?: DragMode
): { point: Point2D; snapInfo: SnapPointInfo | null } {
  if (!objectSnapEnabled) {
    return { point: applyGridSnap(rawWorldPt, snapToGrid, gridStep), snapInfo: null };
  }

  const snapRadiusPx = 22;
  let closestSnap: SnapPointInfo | null = null;
  let minDistancePx = snapRadiusPx;

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

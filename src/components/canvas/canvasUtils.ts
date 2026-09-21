import { Point2D } from '../../types';

export interface SnapPointInfo {
  x: number;
  y: number;
  label: string;
  type: 'endpoint' | 'center' | 'midpoint' | 'corner';
  objectId: string;
}

export interface HoveredHandle {
  objectId: string;
  type: 'line_start' | 'line_end' | 'polyline_point' | 'arc_start' | 'arc_end' | 'arc_center' | 'body';
  pointIndex?: number;
}

/**
 * Calculates arc center, radius and direction from 3 points
 */
export function getArcFrom3Points(p1: Point2D, p2: Point2D, p3: Point2D) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-4) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radius = Math.hypot(x2 - x1, y2 - y1) / 2 || 10;
    return { centerX, centerY, radius, clockwise: true };
  }

  const centerX =
    ((x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2)) /
    D;

  const centerY =
    ((x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1)) /
    D;

  const radius = Math.hypot(x1 - centerX, y1 - centerY);
  const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const clockwise = cross < 0;

  return { centerX, centerY, radius, clockwise };
}

/**
 * Дуга по «начало + конец + вершина горба под мышью».
 *
 * Мышь задаёт не центр и не точку где попало на дуге, а именно ВЕРШИНУ прогиба
 * («горб») — верхнюю точку дуги над серединой хорды. Проекция курсора на
 * перпендикуляр к хорде даёт высоту прогиба (сагитту), а сама вершина всегда
 * лежит на серединном перпендикуляре, поэтому дуга симметрична. Чем ближе мышь
 * к хорде — тем пололее дуга; чем дальше — тем круглее. Возвращаем и саму
 * вершину на дуге — её можно нарисовать под курсором.
 */
export function getArcFromBulge(p1: Point2D, p2: Point2D, mouse: Point2D) {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  const cx = p2.x - p1.x;
  const cy = p2.y - p1.y;
  const chord = Math.hypot(cx, cy);
  if (chord < 1e-4) return null; // начало и конец совпали

  // Единичная нормаль к хорде (направление «вверх горба»).
  const nx = -cy / chord;
  const ny = cx / chord;

  // Знаковая высота прогиба = проекция (мышь − середина хорды) на нормаль.
  let h = (mouse.x - mx) * nx + (mouse.y - my) * ny;
  if (Math.abs(h) < 1e-3) h = h < 0 ? -1e-3 : 1e-3; // не даём дуге стать прямой

  // Вершина горба на серединном перпендикуляре.
  const apex: Point2D = { x: mx + nx * h, y: my + ny * h };

  const arc = getArcFrom3Points(p1, p2, apex);
  return { ...arc, apex };
}

/**
 * Convert World mm to Canvas px
 */
export function worldToCanvas(wx: number, wy: number, pan: Point2D, zoom: number): Point2D {
  return {
    x: pan.x + wy * zoom,
    y: pan.y + wx * zoom,
  };
}

/**
 * Convert Canvas px to World mm
 */
export function canvasToWorld(cx: number, cy: number, pan: Point2D, zoom: number): Point2D {
  return {
    x: (cy - pan.y) / zoom,
    y: (cx - pan.x) / zoom,
  };
}

/**
 * Snap coordinate to grid
 */
export function applyGridSnap(pt: Point2D, snapToGrid: boolean, gridStep: number): Point2D {
  if (!snapToGrid) return pt;
  return {
    x: Math.round(pt.x / gridStep) * gridStep,
    y: Math.round(pt.y / gridStep) * gridStep,
  };
}

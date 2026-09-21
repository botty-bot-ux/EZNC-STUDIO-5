import { ArcMode, Point2D } from '../../types';

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
 * Дуга по «старт + ЦЕНТР + направление на конец».
 *
 * П1 — начало, П2 — центр (тогда радиус = |П1−П2| фиксирован), «живая» мышь задаёт
 * угол конца: конец всегда лежит на окружности ровно под направлением «центр→мышь»,
 * а дуга идёт по короткой стороне от старта к концу. Позволяет рисовать окружности
 * точного радиуса и управлять охватом, водя мышью вокруг центра.
 */
export function getArcFromStartCenterEnd(start: Point2D, center: Point2D, live: Point2D) {
  const r = Math.hypot(start.x - center.x, start.y - center.y);
  if (r < 1e-4) return null; // центр совпал со стартом

  const a1 = Math.atan2(start.y - center.y, start.x - center.x);
  const a2 = Math.atan2(live.y - center.y, live.x - center.x);
  // Короткая дуга: приводим разность углов к (−π, π].
  let d = a2 - a1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) < 1e-4) return null; // конец почти совпал со стартом

  const end: Point2D = { x: center.x + Math.cos(a2) * r, y: center.y + Math.sin(a2) * r };
  const midA = a1 + d / 2;
  const mid: Point2D = { x: center.x + Math.cos(midA) * r, y: center.y + Math.sin(midA) * r };

  const arc = getArcFrom3Points(start, mid, end);
  return { ...arc, end, apex: mid, center };
}

/**
 * Единая сборка превью-дуги для любого под-режима. Возвращает концы/центр/радиус
 * (для отрисовки и для записи в фигуру) плюс необязательные направляющие точки.
 * Возвращает null, пока дуга вырождена (мало точек / слишком прямой угол).
 */
export interface ArcBuild {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  centerX: number;
  centerY: number;
  radius: number;
  clockwise: boolean;
  /** Точка на дуге «под курсором» (вершина горба / средняя точка) — для маркера. */
  apex: Point2D | null;
  /** Центр окружности — только для режима 'center' (рисуем направляющую окружность). */
  guideCenter: Point2D | null;
}

export function buildArc(
  mode: ArcMode,
  p1: Point2D,
  p2: Point2D,
  live: Point2D
): ArcBuild | null {
  if (mode === '3pt') {
    const arc = getArcFrom3Points(p1, p2, live);
    return {
      startX: p1.x,
      startY: p1.y,
      endX: live.x,
      endY: live.y,
      centerX: arc.centerX,
      centerY: arc.centerY,
      radius: arc.radius,
      clockwise: arc.clockwise,
      apex: { x: p2.x, y: p2.y },
      guideCenter: null,
    };
  }
  if (mode === 'center') {
    const arc = getArcFromStartCenterEnd(p1, p2, live);
    if (!arc) return null;
    return {
      startX: p1.x,
      startY: p1.y,
      endX: arc.end.x,
      endY: arc.end.y,
      centerX: arc.centerX,
      centerY: arc.centerY,
      radius: arc.radius,
      clockwise: arc.clockwise,
      apex: arc.apex,
      guideCenter: { x: p2.x, y: p2.y },
    };
  }
  // 'bulge' (по умолчанию)
  const arc = getArcFromBulge(p1, p2, live);
  if (!arc) return null;
  return {
    startX: p1.x,
    startY: p1.y,
    endX: p2.x,
    endY: p2.y,
    centerX: arc.centerX,
    centerY: arc.centerY,
    radius: arc.radius,
    clockwise: arc.clockwise,
    apex: arc.apex,
    guideCenter: null,
  };
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

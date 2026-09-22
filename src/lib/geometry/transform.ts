import { ArcObject, CADObject, MachineSettings, ParallelArc, ParallelSegment, Point2D } from '../../types';

/**
 * Линии, параллельные исходному отрезку, смещённые перпендикулярно (по нормали)
 * на distance·k мм для k = 1..count. Знак distance задаёт сторону смещения.
 * Пустой массив — для вырожденного (нулевой длины) отрезка или count < 1.
 */
export function computeParallelSegments(
  line: ParallelSegment,
  distance: number,
  count: number
): ParallelSegment[] {
  const dx = line.endX - line.startX;
  const dy = line.endY - line.startY;
  const len = Math.hypot(dx, dy);
  if (len === 0 || count < 1) return [];
  const nx = -dy / len;
  const ny = dx / len;
  const out: ParallelSegment[] = [];
  for (let k = 1; k <= count; k++) {
    const off = distance * k;
    out.push({
      startX: line.startX + nx * off,
      startY: line.startY + ny * off,
      endX: line.endX + nx * off,
      endY: line.endY + ny * off,
    });
  }
  return out;
}

/**
 * Дуги, параллельные исходной (концентрические): тот же центр, те же углы и направление,
 * радиус r + distance·k для k = 1..count. Концы смещаются вдоль радиальных лучей, поэтому
 * угловой охват сохраняется. Копии с неположительным радиусом пропускаются.
 */
export function computeParallelArcs(arc: ParallelArc, distance: number, count: number): ParallelArc[] {
  const r = arc.radius;
  if (r === 0 || count < 1) return [];
  const sLen = Math.hypot(arc.startX - arc.centerX, arc.startY - arc.centerY) || r;
  const eLen = Math.hypot(arc.endX - arc.centerX, arc.endY - arc.centerY) || r;
  const usx = (arc.startX - arc.centerX) / sLen;
  const usy = (arc.startY - arc.centerY) / sLen;
  const uex = (arc.endX - arc.centerX) / eLen;
  const uey = (arc.endY - arc.centerY) / eLen;
  const out: ParallelArc[] = [];
  for (let k = 1; k <= count; k++) {
    const rk = r + distance * k;
    if (rk <= 0) continue;
    out.push({
      centerX: arc.centerX,
      centerY: arc.centerY,
      radius: rk,
      startX: arc.centerX + usx * rk,
      startY: arc.centerY + usy * rk,
      endX: arc.centerX + uex * rk,
      endY: arc.centerY + uey * rk,
      clockwise: arc.clockwise,
    });
  }
  return out;
}

/**
 * Вернуть ГЛУБОКУЮ копию фигуры, смещённую на (dx, dy) в системных координатах.
 * Используется групповой вставкой (Ctrl+V), чтобы вставленная копия группы легла
 * рядом с оригиналом, сохранив взаимное расположение фигур.
 */
export function translateCADObject(obj: CADObject, dx: number, dy: number): CADObject {
  const copy = structuredClone(obj);
  switch (copy.type) {
    case 'point':
      copy.x += dx;
      copy.y += dy;
      break;
    case 'line':
      copy.startX += dx;
      copy.startY += dy;
      copy.endX += dx;
      copy.endY += dy;
      break;
    case 'rectangle':
      copy.x += dx;
      copy.y += dy;
      break;
    case 'circle':
      copy.centerX += dx;
      copy.centerY += dy;
      break;
    case 'arc':
      copy.startX += dx;
      copy.startY += dy;
      copy.endX += dx;
      copy.endY += dy;
      copy.centerX += dx;
      copy.centerY += dy;
      break;
    case 'polyline':
      if (copy.points) copy.points = copy.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      break;
  }
  return copy;
}

/**
 * Ограничивающая ось-выравненная рамка фигуры (мир, мм) — для якоря масштабирования.
 */
export function computeObjectBounds(obj: CADObject): ArcBounds {
  switch (obj.type) {
    case 'point':
      return { minX: obj.x, minY: obj.y, maxX: obj.x, maxY: obj.y };
    case 'line':
      return {
        minX: Math.min(obj.startX, obj.endX),
        minY: Math.min(obj.startY, obj.endY),
        maxX: Math.max(obj.startX, obj.endX),
        maxY: Math.max(obj.startY, obj.endY),
      };
    case 'polyline': {
      const xs = obj.points.map((p) => p.x);
      const ys = obj.points.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
    case 'rectangle':
      return {
        minX: Math.min(obj.x, obj.x + obj.width),
        minY: Math.min(obj.y, obj.y + obj.height),
        maxX: Math.max(obj.x, obj.x + obj.width),
        maxY: Math.max(obj.y, obj.y + obj.height),
      };
    case 'circle':
      return {
        minX: obj.centerX - obj.radius,
        minY: obj.centerY - obj.radius,
        maxX: obj.centerX + obj.radius,
        maxY: obj.centerY + obj.radius,
      };
    case 'arc':
      return computeArcBounds(obj);
  }
}

/**
 * Вернуть ГЛУБОКУЮ копию фигуры, растянутую относительно точки anchor: каждая
 * координата мира p переходит в anchor + (p − anchor)·s (s = sx по X, sy по Y).
 * Растяжение по осям (sx ≠ sy) корректно для линий/полилиний/прямоугольников/точек;
 * окружности и дуги остаются КРУГЛЫМИ — их радиус масштабируется средним множителем
 * (иначе окружность превратилась бы в эллипс, которого в модели нет).
 * Отрицательный множитель отражает фигуру относительно anchor.
 */
export function scaleCADObject(
  obj: CADObject,
  anchor: Point2D,
  sx: number,
  sy: number
): CADObject {
  const copy = structuredClone(obj);
  const X = (v: number) => anchor.x + (v - anchor.x) * sx;
  const Y = (v: number) => anchor.y + (v - anchor.y) * sy;
  const sAvg = (sx + sy) / 2;

  switch (copy.type) {
    case 'point':
      copy.x = X(copy.x);
      copy.y = Y(copy.y);
      break;
    case 'line':
      copy.startX = X(copy.startX);
      copy.startY = Y(copy.startY);
      copy.endX = X(copy.endX);
      copy.endY = Y(copy.endY);
      break;
    case 'rectangle': {
      // Пересобираем из «углов» рамки: переживает и отрицательные размеры.
      const x1 = X(Math.min(copy.x, copy.x + copy.width));
      const x2 = X(Math.max(copy.x, copy.x + copy.width));
      const y1 = Y(Math.min(copy.y, copy.y + copy.height));
      const y2 = Y(Math.max(copy.y, copy.y + copy.height));
      const flipX = copy.width < 0;
      const flipY = copy.height < 0;
      copy.x = flipX ? x2 : x1;
      copy.y = flipY ? y2 : y1;
      copy.width = x2 - x1;
      copy.height = y2 - y1;
      break;
    }
    case 'circle':
      copy.centerX = X(copy.centerX);
      copy.centerY = Y(copy.centerY);
      copy.radius = Math.abs(copy.radius * sAvg);
      break;
    case 'arc': {
      // Дуга остаётся ДУГОЙ окружности: радиус множится на средний масштаб,
      // центр и концы следуют общему растяжению. Точное эллиптическое растяжение
      // дуги в модели не представимо — честнее сохранить круговую форму.
      const oldCx = copy.centerX;
      const oldCy = copy.centerY;
      const ang0 = Math.atan2(copy.startY - oldCy, copy.startX - oldCx);
      const ang1 = Math.atan2(copy.endY - oldCy, copy.endX - oldCx);
      copy.centerX = X(copy.centerX);
      copy.centerY = Y(copy.centerY);
      copy.radius = Math.max(1e-3, Math.abs(copy.radius * sAvg));
      copy.startX = copy.centerX + Math.cos(ang0) * copy.radius;
      copy.startY = copy.centerY + Math.sin(ang0) * copy.radius;
      copy.endX = copy.centerX + Math.cos(ang1) * copy.radius;
      copy.endY = copy.centerY + Math.sin(ang1) * copy.radius;
      break;
    }
    case 'polyline':
      if (copy.points) {
        copy.points = copy.points.map((p) => ({ x: X(p.x), y: Y(p.y) }));
      }
      break;
  }
  return copy;
}

/**
 * Transforms program coordinate (x, y) to machine coordinate based on machine settings
 */
export function transformProgramToMachine(
  p: Point2D,
  machine: MachineSettings
): Point2D {
  return {
    x: p.x + machine.workOffset.x,
    y: p.y + machine.workOffset.y,
  };
}

/**
 * Inverse transformation: Machine coordinate (x, y) back to program coordinate
 */
export function transformMachineToProgram(
  p: Point2D,
  machine: MachineSettings
): Point2D {
  return {
    x: p.x - machine.workOffset.x,
    y: p.y - machine.workOffset.y,
  };
}

/**
 * Checks if a machine coordinate point lies within machine bounds
 */
export function isPointWithinBounds(p: Point2D, machine: MachineSettings): boolean {
  const { xMin, xMax, yMin, yMax } = machine.bounds;
  const minX = Math.min(xMin, xMax);
  const maxX = Math.max(xMin, xMax);
  const minY = Math.min(yMin, yMax);
  const maxY = Math.max(yMin, yMax);
  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

/**
 * Formats a coordinate number to fixed decimal places (e.g. 3 decimals for G-code)
 */
export function formatNum(val: number, decimals: number = 3): string {
  if (Math.abs(val) < 0.00001) return (0).toFixed(decimals);
  return val.toFixed(decimals);
}

/**
 * Constrains the segment from -> to so its direction snaps to the nearest multiple
 * of stepDeg (default 45° => orthogonal 0/90° plus diagonals). The length (radius) is
 * preserved, so it behaves like Shift in AutoCAD ORTHO / SolidWorks sketch polars.
 * Returns the original point when it coincides with the anchor (nothing to snap).
 */
export function constrainAngle(
  from: Point2D,
  to: Point2D,
  stepDeg: number = 45
): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const radius = Math.hypot(dx, dy);
  if (radius < 1e-6) return to;

  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / step) * step;

  return {
    x: from.x + radius * Math.cos(snapped),
    y: from.y + radius * Math.sin(snapped),
  };
}

export interface ArcBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Axis-aligned bounding box of an arc in program coordinates. Includes the two
 * endpoints plus any cardinal extreme point (±X, ±Y) that the sweep actually passes.
 */
export function computeArcBounds(arc: ArcObject): ArcBounds {
  const { centerX: cx, centerY: cy, radius: r } = arc;
  const TAU = Math.PI * 2;
  const norm = (x: number) => ((x % TAU) + TAU) % TAU;

  const a0 = Math.atan2(arc.startY - cy, arc.startX - cx);
  const a1 = Math.atan2(arc.endY - cy, arc.endX - cx);

  // Is a given absolute angle traversed going from a0 to a1 in the arc's direction?
  const inSweep = (t: number): boolean => {
    const A0 = norm(a0);
    const A1 = norm(a1);
    const T = norm(t);
    if (arc.clockwise) {
      // clockwise = decreasing angle
      const span = norm(A0 - A1);
      const at = norm(A0 - T);
      return at <= span + 1e-9;
    }
    const span = norm(A1 - A0);
    const at = norm(T - A0);
    return at <= span + 1e-9;
  };

  let minX = Math.min(arc.startX, arc.endX);
  let maxX = Math.max(arc.startX, arc.endX);
  let minY = Math.min(arc.startY, arc.endY);
  let maxY = Math.max(arc.startY, arc.endY);

  if (inSweep(0)) maxX = Math.max(maxX, cx + r); // +X
  if (inSweep(Math.PI)) minX = Math.min(minX, cx - r); // -X
  if (inSweep(Math.PI / 2)) maxY = Math.max(maxY, cy + r); // +Y
  if (inSweep((3 * Math.PI) / 2)) minY = Math.min(minY, cy - r); // -Y

  return { minX, minY, maxX, maxY };
}

/**
 * Mirror an arc in place about its own bounding-box center.
 * 'h' = horizontal flip (reflect X, left↔right); 'v' = vertical flip (reflect Y, up↕down).
 * Reflection is an isometry, so the radius is preserved; the sweep handedness reverses,
 * so `clockwise` is toggled. Returns only the fields that change.
 */
export function mirrorArc(arc: ArcObject, axis: 'h' | 'v'): Partial<ArcObject> {
  const b = computeArcBounds(arc);
  if (axis === 'h') {
    const cx = (b.minX + b.maxX) / 2;
    return {
      startX: 2 * cx - arc.startX,
      endX: 2 * cx - arc.endX,
      centerX: 2 * cx - arc.centerX,
      clockwise: !arc.clockwise,
    };
  }
  const cy = (b.minY + b.maxY) / 2;
  return {
    startY: 2 * cy - arc.startY,
    endY: 2 * cy - arc.endY,
    centerY: 2 * cy - arc.centerY,
    clockwise: !arc.clockwise,
  };
}


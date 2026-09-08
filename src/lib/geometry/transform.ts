import { ArcObject, CADObject, MachineSettings, Point2D } from '../../types';

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


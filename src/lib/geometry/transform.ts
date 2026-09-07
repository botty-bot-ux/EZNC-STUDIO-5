import { MachineSettings, Point2D } from '../../types';

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


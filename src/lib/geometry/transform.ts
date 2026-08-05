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


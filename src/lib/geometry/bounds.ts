import { CADObject, MachineSettings, ToolpathSegment } from '../../types';
import { computeArcBounds, computeObjectsBounds } from './transform';

export const DEFAULT_Z_MIN = -50;
export const DEFAULT_Z_MAX = 100;

export interface NormalizedMachineBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface SegmentBoundsCheck {
  outX: boolean;
  outY: boolean;
  outZ: boolean;
  outAny: boolean;
}

export interface TrajectoryBoundsSummary {
  machine: NormalizedMachineBounds;
  hasTrajectory: boolean;
  trajMinX: number;
  trajMaxX: number;
  trajMinY: number;
  trajMaxY: number;
  trajMinZ: number;
  trajMaxZ: number;
  exceedsXMin: boolean;
  exceedsXMax: boolean;
  exceedsYMin: boolean;
  exceedsYMax: boolean;
  exceedsZMin: boolean;
  exceedsZMax: boolean;
  outX: boolean;
  outY: boolean;
  outZ: boolean;
  outOfBounds: boolean;
  outOfBoundsSegmentIds: Set<string>;
}

/**
 * Нормализует границы рабочего поля станка (гарантирует min <= max по X, Y, Z).
 */
export function normalizeMachineBounds(
  bounds: MachineSettings['bounds']
): NormalizedMachineBounds {
  const xMin = bounds.xMin;
  const xMax = bounds.xMax;
  const yMin = bounds.yMin;
  const yMax = bounds.yMax;
  const zMinRaw = bounds.zMin ?? DEFAULT_Z_MIN;
  const zMaxRaw = bounds.zMax ?? DEFAULT_Z_MAX;

  return {
    minX: Math.min(xMin, xMax),
    maxX: Math.max(xMin, xMax),
    minY: Math.min(yMin, yMax),
    maxY: Math.max(yMin, yMax),
    minZ: Math.min(zMinRaw, zMaxRaw),
    maxZ: Math.max(zMinRaw, zMaxRaw),
  };
}

/**
 * Возвращает габарит сегмента траектории в программных координатах (с учётом вылета дуги).
 */
export function computeSegmentBounds(seg: ToolpathSegment): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Math.min(seg.startX, seg.endX);
  let maxX = Math.max(seg.startX, seg.endX);
  let minY = Math.min(seg.startY, seg.endY);
  let maxY = Math.max(seg.startY, seg.endY);

  if (
    (seg.type === 'arc_cw' || seg.type === 'arc_ccw') &&
    seg.centerX !== undefined &&
    seg.centerY !== undefined
  ) {
    const r = seg.radius ?? Math.hypot(seg.startX - seg.centerX, seg.startY - seg.centerY);
    if (r > 1e-4) {
      const isFullCircle = Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY) < 0.01;
      if (isFullCircle) {
        minX = seg.centerX - r;
        maxX = seg.centerX + r;
        minY = seg.centerY - r;
        maxY = seg.centerY + r;
      } else {
        const b = computeArcBounds({
          id: seg.id,
          name: '',
          type: 'arc',
          startX: seg.startX,
          startY: seg.startY,
          endX: seg.endX,
          endY: seg.endY,
          centerX: seg.centerX,
          centerY: seg.centerY,
          radius: r,
          clockwise: seg.type === 'arc_cw',
          depth: 0,
          operationType: 'cut',
        });
        minX = b.minX;
        maxX = b.maxX;
        minY = b.minY;
        maxY = b.maxY;
      }
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ: Math.min(seg.startZ, seg.endZ),
    maxZ: Math.max(seg.startZ, seg.endZ),
  };
}

export function isSegmentOutOfBounds(
  seg: ToolpathSegment,
  machine: MachineSettings,
  eps = 0.01
): SegmentBoundsCheck {
  const mb = normalizeMachineBounds(machine.bounds);
  const offX = machine.workOffset?.x ?? 0;
  const offY = machine.workOffset?.y ?? 0;
  const b = computeSegmentBounds(seg);

  const mMinX = b.minX + offX;
  const mMaxX = b.maxX + offX;
  const mMinY = b.minY + offY;
  const mMaxY = b.maxY + offY;

  const outX = mMinX < mb.minX - eps || mMaxX > mb.maxX + eps;
  const outY = mMinY < mb.minY - eps || mMaxY > mb.maxY + eps;
  const outZ = b.minZ < mb.minZ - eps || b.maxZ > mb.maxZ + eps;

  return {
    outX,
    outY,
    outZ,
    outAny: outX || outY || outZ,
  };
}

/**
 * Сравнивает фактический габарит траектории (или видимых фигур, если траектории нет)
 * с границами рабочего поля станка по осям X, Y и Z (в машинных координатах).
 */
export function analyzeTrajectoryBounds(
  segments: ToolpathSegment[],
  machine: MachineSettings,
  objects: CADObject[] = [],
  eps = 0.01
): TrajectoryBoundsSummary {
  const mb = normalizeMachineBounds(machine.bounds);
  const offX = machine.workOffset?.x ?? 0;
  const offY = machine.workOffset?.y ?? 0;

  let trajMinX = Infinity;
  let trajMaxX = -Infinity;
  let trajMinY = Infinity;
  let trajMaxY = -Infinity;
  let trajMinZ = Infinity;
  let trajMaxZ = -Infinity;
  const outOfBoundsSegmentIds = new Set<string>();

  if (segments.length > 0) {
    for (const seg of segments) {
      const b = computeSegmentBounds(seg);
      const mMinX = b.minX + offX;
      const mMaxX = b.maxX + offX;
      const mMinY = b.minY + offY;
      const mMaxY = b.maxY + offY;

      if (mMinX < trajMinX) trajMinX = mMinX;
      if (mMaxX > trajMaxX) trajMaxX = mMaxX;
      if (mMinY < trajMinY) trajMinY = mMinY;
      if (mMaxY > trajMaxY) trajMaxY = mMaxY;
      if (b.minZ < trajMinZ) trajMinZ = b.minZ;
      if (b.maxZ > trajMaxZ) trajMaxZ = b.maxZ;

      if (
        mMinX < mb.minX - eps ||
        mMaxX > mb.maxX + eps ||
        mMinY < mb.minY - eps ||
        mMaxY > mb.maxY + eps ||
        b.minZ < mb.minZ - eps ||
        b.maxZ > mb.maxZ + eps
      ) {
        outOfBoundsSegmentIds.add(seg.id);
      }
    }
  } else {
    const visibleObjs = objects.filter((o) => o.visible !== false);
    const ob = computeObjectsBounds(visibleObjs);
    if (ob) {
      trajMinX = ob.minX + offX;
      trajMaxX = ob.maxX + offX;
      trajMinY = ob.minY + offY;
      trajMaxY = ob.maxY + offY;
      let deepest = 0;
      for (const o of visibleObjs) {
        if (o.depth > deepest) deepest = o.depth;
      }
      trajMinZ = -deepest;
      trajMaxZ = machine.safeZ;
    }
  }

  const hasTrajectory = Number.isFinite(trajMinX) && Number.isFinite(trajMinY);
  if (!hasTrajectory) {
    return {
      machine: mb,
      hasTrajectory: false,
      trajMinX: 0,
      trajMaxX: 0,
      trajMinY: 0,
      trajMaxY: 0,
      trajMinZ: 0,
      trajMaxZ: 0,
      exceedsXMin: false,
      exceedsXMax: false,
      exceedsYMin: false,
      exceedsYMax: false,
      exceedsZMin: false,
      exceedsZMax: false,
      outX: false,
      outY: false,
      outZ: false,
      outOfBounds: false,
      outOfBoundsSegmentIds,
    };
  }

  const exceedsXMin = trajMinX < mb.minX - eps;
  const exceedsXMax = trajMaxX > mb.maxX + eps;
  const exceedsYMin = trajMinY < mb.minY - eps;
  const exceedsYMax = trajMaxY > mb.maxY + eps;
  const exceedsZMin = trajMinZ < mb.minZ - eps;
  const exceedsZMax = trajMaxZ > mb.maxZ + eps;

  const outX = exceedsXMin || exceedsXMax;
  const outY = exceedsYMin || exceedsYMax;
  const outZ = exceedsZMin || exceedsZMax;

  return {
    machine: mb,
    hasTrajectory: true,
    trajMinX,
    trajMaxX,
    trajMinY,
    trajMaxY,
    trajMinZ,
    trajMaxZ,
    exceedsXMin,
    exceedsXMax,
    exceedsYMin,
    exceedsYMax,
    exceedsZMin,
    exceedsZMax,
    outX,
    outY,
    outZ,
    outOfBounds: outX || outY || outZ,
    outOfBoundsSegmentIds,
  };
}

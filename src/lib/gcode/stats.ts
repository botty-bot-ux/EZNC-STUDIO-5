import { MachineSettings, ToolpathSegment } from '../../types';

export interface ToolpathStats {
  cutLengthMm: number;
  rapidLengthMm: number;
  drillCount: number;
  estimatedSeconds: number;
}

const RAPID_FEED_MM_MIN = 4000;

function segmentLengthMm(seg: ToolpathSegment): number {
  if ((seg.type === 'arc_cw' || seg.type === 'arc_ccw') && seg.centerX !== undefined && seg.centerY !== undefined) {
    const r = Math.hypot(seg.startX - seg.centerX, seg.startY - seg.centerY);
    if (r > 1e-4) {
      const isFullCircle = Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY) < 0.01;
      let sweep = Math.PI * 2;
      if (!isFullCircle) {
        const a1 = Math.atan2(seg.startY - seg.centerY, seg.startX - seg.centerX);
        const a2 = Math.atan2(seg.endY - seg.centerY, seg.endX - seg.centerX);
        const twoPi = Math.PI * 2;
        sweep =
          seg.type === 'arc_cw'
            ? (a1 - a2 + twoPi) % twoPi
            : (a2 - a1 + twoPi) % twoPi;
        if (sweep < 1e-4) sweep = twoPi;
      }
      const arcXY = r * sweep;
      const dz = seg.endZ - seg.startZ;
      return Math.hypot(arcXY, dz);
    }
  }
  return Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY, seg.endZ - seg.startZ);
}

/**
 * Считает суммарный рабочий рез, холостые ходы, число сверлений и ориентировочное
 * время выполнения программы (секунды) по траектории и подачам станка.
 */
export function computeToolpathStats(
  segments: ToolpathSegment[],
  machine: MachineSettings
): ToolpathStats {
  if (segments.length === 0) {
    return { cutLengthMm: 0, rapidLengthMm: 0, drillCount: 0, estimatedSeconds: 0 };
  }

  let cutLengthMm = 0;
  let rapidLengthMm = 0;
  let drillCount = 0;
  let seconds = 0;

  const cutFeed = Math.max(machine.feedCut || 1200, 1);
  const plungeFeed = Math.max(machine.feedPlunge || 300, 1);
  const drillFeed = Math.max(machine.feedDrill || 500, 1);

  for (const seg of segments) {
    const len = segmentLengthMm(seg);
    if (seg.type === 'rapid') {
      rapidLengthMm += len;
      seconds += (len / RAPID_FEED_MM_MIN) * 60;
    } else if (seg.type === 'drill') {
      drillCount += 1;
      const depth = Math.max(Math.abs(seg.endZ - seg.startZ), 5);
      seconds += (depth / drillFeed) * 60 + 0.35;
    } else {
      cutLengthMm += len;
      const isPurePlunge =
        seg.type === 'feed' &&
        Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY) < 0.01 &&
        seg.endZ < seg.startZ;
      const feed = seg.feed && seg.feed > 0 ? seg.feed : isPurePlunge ? plungeFeed : cutFeed;
      seconds += (len / feed) * 60;
    }
  }

  // Учитываем паузу на раскрутку шпинделя, если есть режущие операции
  if (cutLengthMm > 0 || drillCount > 0) {
    seconds += (machine.spindleDwell || 0) / 1000;
  }

  return {
    cutLengthMm,
    rapidLengthMm,
    drillCount,
    estimatedSeconds: seconds,
  };
}

export function formatDurationRu(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} сек`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins < 60) return rem > 0 ? `${mins} мин ${rem} с` : `${mins} мин`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs} ч ${remMins} мин`;
}

export function formatDistanceRu(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} м`;
  return `${mm.toFixed(0)} мм`;
}

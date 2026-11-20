import { ToolpathSegment } from '../../types';

export interface MiniMapPath {
  id: string;
  d: string;
  type: ToolpathSegment['type'];
}

export interface MiniMapData {
  viewBox: string;
  allPaths: MiniMapPath[];
  activePaths: MiniMapPath[];
  focusPath: { d: string; type: ToolpathSegment['type']; endX: number; endY: number } | null;
}

export function segmentToSvgPath(seg: ToolpathSegment): string {
  // Координатная система 2D-холста (worldToCanvas): экранный X = мировой Y, экранный Y = мировой X
  const sx = seg.startY;
  const sy = seg.startX;
  const ex = seg.endY;
  const ey = seg.endX;

  if (
    (seg.type === 'arc_cw' || seg.type === 'arc_ccw') &&
    seg.centerX !== undefined &&
    seg.centerY !== undefined
  ) {
    const cx = seg.centerY;
    const cy = seg.centerX;
    const r = Math.hypot(sx - cx, sy - cy);
    if (r > 0.05) {
      const isFullCircle = Math.hypot(ex - sx, ey - sy) < 0.01;
      if (isFullCircle) {
        return `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(cx + r).toFixed(2)} ${cy.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(cx - r).toFixed(2)} ${cy.toFixed(2)}`;
      }
      const a1 = Math.atan2(sy - cy, sx - cx);
      const a2 = Math.atan2(ey - cy, ex - cx);
      const anticlockwise = seg.type !== 'arc_cw';
      const twoPi = Math.PI * 2;
      const sweepAngle = anticlockwise
        ? (a1 - a2 + twoPi) % twoPi
        : (a2 - a1 + twoPi) % twoPi;
      const largeArcFlag = sweepAngle > Math.PI ? 1 : 0;
      const sweepFlag = anticlockwise ? 0 : 1;
      return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArcFlag} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
    }
  }

  const dx = ex - sx;
  const dy = ey - sy;
  if (Math.hypot(dx, dy) < 0.01) {
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} l 0.01 0`;
  }
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} L ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

export function buildMiniMapMeta(segments: ToolpathSegment[]): {
  viewBox: string;
  paths: MiniMapPath[];
} {
  if (segments.length === 0) {
    return { viewBox: '0 0 100 100', paths: [] };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const expand = (wx: number, wy: number) => {
    // svgX = wy, svgY = wx (синхронно с worldToCanvas)
    if (wy < minX) minX = wy;
    if (wy > maxX) maxX = wy;
    if (wx < minY) minY = wx;
    if (wx > maxY) maxY = wx;
  };

  const paths: MiniMapPath[] = [];
  for (const seg of segments) {
    expand(seg.startX, seg.startY);
    expand(seg.endX, seg.endY);
    if (
      (seg.type === 'arc_cw' || seg.type === 'arc_ccw') &&
      seg.centerX !== undefined &&
      seg.centerY !== undefined
    ) {
      const r = Math.hypot(seg.startX - seg.centerX, seg.startY - seg.centerY);
      expand(seg.centerX - r, seg.centerY - r);
      expand(seg.centerX + r, seg.centerY + r);
    }
    paths.push({ id: seg.id, d: segmentToSvgPath(seg), type: seg.type });
  }

  const spanX = Math.max(maxX - minX, 10);
  const spanY = Math.max(maxY - minY, 10);
  const pad = Math.max(spanX, spanY) * 0.12;
  const viewBox = `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(spanX + pad * 2).toFixed(1)} ${(spanY + pad * 2).toFixed(1)}`;
  return { viewBox, paths };
}

export function getMotionBadgeInfo(seg: ToolpathSegment): {
  label: string;
  badgeClass: string;
} {
  const dx = seg.endX - seg.startX;
  const dy = seg.endY - seg.startY;
  const dz = seg.endZ - seg.startZ;
  const isZeroXY = seg.type !== 'arc_cw' && seg.type !== 'arc_ccw' && Math.hypot(dx, dy) < 0.01;

  if (seg.type === 'rapid') {
    return {
      label: isZeroXY && dz > 0 ? 'G00 Подъём' : 'G00 Холостой',
      badgeClass: 'bg-danger/15 text-danger border-danger/30',
    };
  }
  if (seg.type === 'arc_cw') {
    return {
      label: 'G02 Дуга CW',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    };
  }
  if (seg.type === 'arc_ccw') {
    return {
      label: 'G03 Дуга CCW',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    };
  }
  if (seg.type === 'drill') {
    return {
      label: 'Сверление',
      badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    };
  }
  if (isZeroXY && dz < 0) {
    return {
      label: 'G01 Врезание Z',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    };
  }
  return {
    label: 'G01 Рабочий ход',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  };
}

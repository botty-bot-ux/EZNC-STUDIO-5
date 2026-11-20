import { GcodeScrollPreview, Point2D, ToolpathSegment } from '../../types';
import { CanvasPalette, LIGHT_PALETTE } from './canvasPalette';
import { worldToCanvas } from './canvasUtils';

function traceSegmentPath(
  ctx: CanvasRenderingContext2D,
  seg: ToolpathSegment,
  pan: Point2D,
  zoom: number
): { pStart: Point2D; pEnd: Point2D; isZeroXY: boolean; cp?: Point2D; rPx?: number; a1?: number; a2?: number; isFullCircle?: boolean } {
  const pStart = worldToCanvas(seg.startX, seg.startY, pan, zoom);
  const pEnd = worldToCanvas(seg.endX, seg.endY, pan, zoom);
  const isZeroXY =
    seg.type !== 'arc_cw' &&
    seg.type !== 'arc_ccw' &&
    Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) < 0.75;

  ctx.beginPath();
  if ((seg.type === 'arc_cw' || seg.type === 'arc_ccw') && seg.centerX !== undefined && seg.centerY !== undefined) {
    const cp = worldToCanvas(seg.centerX, seg.centerY, pan, zoom);
    const r = Math.hypot(seg.startX - seg.centerX, seg.startY - seg.centerY);
    const rPx = r * zoom;
    if (rPx > 0.1) {
      const isFullCircle = Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY) < 0.01;
      if (isFullCircle) {
        ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
        return { pStart, pEnd, isZeroXY: false, cp, rPx, a1: 0, a2: Math.PI * 2, isFullCircle: true };
      } else {
        const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
        const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);
        // worldToCanvas swaps X/Y (reflection), so world CW maps to canvas anticlockwise=false
        ctx.arc(cp.x, cp.y, rPx, a1, a2, seg.type !== 'arc_cw');
        return { pStart, pEnd, isZeroXY: false, cp, rPx, a1, a2, isFullCircle: false };
      }
    }
  }

  ctx.moveTo(pStart.x, pStart.y);
  ctx.lineTo(pEnd.x, pEnd.y);
  return { pStart, pEnd, isZeroXY };
}

function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ux: number,
  uy: number,
  color: string,
  size = 8
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + ux * size * 0.65, y + uy * size * 0.65);
  ctx.lineTo(x - ux * size * 0.55 - uy * size * 0.45, y - uy * size * 0.55 + ux * size * 0.45);
  ctx.lineTo(x - ux * size * 0.55 + uy * size * 0.45, y - uy * size * 0.55 - ux * size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawToolpathSegments(
  ctx: CanvasRenderingContext2D,
  segments: ToolpathSegment[],
  pan: Point2D,
  zoom: number
) {
  ctx.save();
  for (const seg of segments) {
    const pStart = worldToCanvas(seg.startX, seg.startY, pan, zoom);
    const pEnd = worldToCanvas(seg.endX, seg.endY, pan, zoom);

    if (seg.type === 'rapid') {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (seg.type === 'feed') {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
    } else if (seg.type === 'arc_cw' || seg.type === 'arc_ccw') {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (seg.centerX !== undefined && seg.centerY !== undefined) {
        const cp = worldToCanvas(seg.centerX, seg.centerY, pan, zoom);
        const r = Math.hypot(seg.startX - seg.centerX, seg.startY - seg.centerY);
        const rPx = r * zoom;
        if (rPx > 0.1) {
          const isFullCircle =
            Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY) < 0.01;
          if (isFullCircle) {
            ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
          } else {
            const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
            const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);
            // worldToCanvas swaps X/Y (reflection), so world CW maps to canvas anticlockwise=false
            ctx.arc(cp.x, cp.y, rPx, a1, a2, seg.type !== 'arc_cw');
          }
        } else {
          ctx.moveTo(pStart.x, pStart.y);
          ctx.lineTo(pEnd.x, pEnd.y);
        }
      } else {
        ctx.moveTo(pStart.x, pStart.y);
        ctx.lineTo(pEnd.x, pEnd.y);
      }
      ctx.stroke();
    } else if (seg.type === 'drill') {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(pEnd.x, pEnd.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Подсвечивает на 2D-холсте сегменты траектории, соответствующие видимым/активным строкам
 * в редакторе G-кода при прокрутке: мягкое свечение диапазона, яркий акцент на фокусном
 * кадре, стрелка направления движения и позиция фрезы с номером строки.
 */
export function drawGcodeScrollHighlight(
  ctx: CanvasRenderingContext2D,
  preview: GcodeScrollPreview,
  pan: Point2D,
  zoom: number,
  palette: CanvasPalette = LIGHT_PALETTE
) {
  if (!preview || preview.segments.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let focusSeg: ToolpathSegment | null = null;

  // 1. Все сегменты из видимого окна редактора
  for (const seg of preview.segments) {
    if (preview.focusSegmentId && seg.id === preview.focusSegmentId) {
      focusSeg = seg;
      continue;
    }

    const geom = traceSegmentPath(ctx, seg, pan, zoom);
    if (seg.type === 'drill' || geom.isZeroXY) {
      ctx.fillStyle = seg.type === 'rapid' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.28)';
      ctx.strokeStyle = seg.type === 'rapid' ? 'rgba(239, 68, 68, 0.85)' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(geom.pEnd.x, geom.pEnd.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      continue;
    }

    const coreColor =
      seg.type === 'rapid'
        ? 'rgba(239, 68, 68, 0.82)'
        : seg.type === 'arc_cw' || seg.type === 'arc_ccw'
        ? '#10b981'
        : '#f59e0b';
    const glowColor =
      seg.type === 'rapid'
        ? 'rgba(239, 68, 68, 0.18)'
        : seg.type === 'arc_cw' || seg.type === 'arc_ccw'
        ? 'rgba(16, 185, 129, 0.24)'
        : 'rgba(245, 158, 11, 0.26)';

    // Внешнее свечение
    ctx.setLineDash(seg.type === 'rapid' ? [6, 5] : []);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 9;
    ctx.stroke();

    // Основная линия подсветки
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = seg.type === 'rapid' ? 2.2 : 3.4;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 2. Фокусный (центральный/выбранный) сегмент — максимально выраженный акцент
  if (!focusSeg) {
    focusSeg = preview.segments[preview.segments.length - 1];
  }

  if (focusSeg) {
    const geom = traceSegmentPath(ctx, focusSeg, pan, zoom);
    const isRapid = focusSeg.type === 'rapid';
    const isArc = focusSeg.type === 'arc_cw' || focusSeg.type === 'arc_ccw';
    const focusColor = isRapid ? '#ef4444' : isArc ? '#22c55e' : '#f97316';
    const focusGlow = isRapid
      ? 'rgba(239, 68, 68, 0.34)'
      : isArc
      ? 'rgba(34, 197, 94, 0.36)'
      : 'rgba(249, 115, 22, 0.38)';

    if (!geom.isZeroXY && focusSeg.type !== 'drill') {
      ctx.setLineDash(isRapid ? [7, 5] : []);
      ctx.strokeStyle = focusGlow;
      ctx.lineWidth = 12;
      ctx.stroke();

      ctx.strokeStyle = focusColor;
      ctx.lineWidth = isRapid ? 3 : 4.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Стрелка направления движения
      if (geom.cp && geom.rPx !== undefined && geom.rPx >= 8 && geom.a1 !== undefined && geom.a2 !== undefined) {
        const anticlockwise = focusSeg.type !== 'arc_cw';
        let aMid = geom.a1;
        if (!geom.isFullCircle) {
          const twoPi = Math.PI * 2;
          const delta = anticlockwise
            ? (geom.a1 - geom.a2 + twoPi) % twoPi
            : (geom.a2 - geom.a1 + twoPi) % twoPi;
          aMid = anticlockwise ? geom.a1 - delta / 2 : geom.a1 + delta / 2;
        }
        const mx = geom.cp.x + geom.rPx * Math.cos(aMid);
        const my = geom.cp.y + geom.rPx * Math.sin(aMid);
        const ux = anticlockwise ? Math.sin(aMid) : -Math.sin(aMid);
        const uy = anticlockwise ? -Math.cos(aMid) : Math.cos(aMid);
        drawDirectionArrow(ctx, mx, my, ux, uy, focusColor, 10);
      } else {
        const vx = geom.pEnd.x - geom.pStart.x;
        const vy = geom.pEnd.y - geom.pStart.y;
        const len = Math.hypot(vx, vy);
        if (len >= 14) {
          drawDirectionArrow(
            ctx,
            (geom.pStart.x + geom.pEnd.x) / 2,
            (geom.pStart.y + geom.pEnd.y) / 2,
            vx / len,
            vy / len,
            focusColor,
            10
          );
        }
      }
    }

    // Прицел текущей позиции инструмента в конце фокусного кадра
    const ex = geom.pEnd.x;
    const ey = geom.pEnd.y;
    ctx.fillStyle = focusGlow;
    ctx.beginPath();
    ctx.arc(ex, ey, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.labelChip;
    ctx.strokeStyle = focusColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = focusColor;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Подпись номера строки и Z у прицела
    const lineNum = focusSeg.lineNumber ?? preview.focusLine;
    const zPart = `Z${focusSeg.endZ.toFixed(1)}`;
    const badgeText = `Стр. ${lineNum} · ${zPart}`;
    ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    const textW = ctx.measureText(badgeText).width;
    const padX = 7;
    const badgeW = textW + padX * 2;
    const badgeH = 20;
    const bx = ex + 12;
    const by = ey - badgeH - 8;

    ctx.fillStyle = palette.labelChip;
    ctx.strokeStyle = focusColor;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx, by, badgeW, badgeH, 5);
    } else {
      ctx.rect(bx, by, badgeW, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.labelTextStrong;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, bx + padX, by + badgeH / 2);
  }

  ctx.restore();
}

/**
 * Подсвечивает сегменты траектории, выходящие за границы рабочего поля станка (X, Y или Z).
 */
export function drawOutOfBoundsSegments(
  ctx: CanvasRenderingContext2D,
  segments: ToolpathSegment[],
  outOfBoundsIds: Set<string>,
  pan: Point2D,
  zoom: number
) {
  if (outOfBoundsIds.size === 0 || segments.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const seg of segments) {
    if (!outOfBoundsIds.has(seg.id)) continue;

    const geom = traceSegmentPath(ctx, seg, pan, zoom);
    if (seg.type === 'drill' || geom.isZeroXY) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(geom.pEnd.x, geom.pEnd.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      continue;
    }

    ctx.setLineDash(seg.type === 'rapid' ? [6, 4] : []);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.26)';
    ctx.lineWidth = 9;
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}


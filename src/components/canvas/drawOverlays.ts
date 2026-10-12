import { ParallelPreviewState, Point2D } from '../../types';
import { SnapPointInfo, worldToCanvas } from './canvasUtils';
import { CanvasPalette, LIGHT_PALETTE } from './canvasPalette';

export function drawSnapIndicator(
  ctx: CanvasRenderingContext2D,
  activeSnapInfo: SnapPointInfo,
  pan: Point2D,
  zoom: number
) {
  const sp = worldToCanvas(activeSnapInfo.x, activeSnapInfo.y, pan, zoom);

  ctx.save();
  const isCenter = activeSnapInfo.type === 'center';
  const isEndpoint = activeSnapInfo.type === 'endpoint';

  ctx.strokeStyle = isCenter ? '#f59e0b' : isEndpoint ? '#22c55e' : '#38bdf8';
  ctx.fillStyle = isCenter ? 'rgba(245, 158, 11, 0.25)' : isEndpoint ? 'rgba(34, 197, 94, 0.25)' : 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 2;

  const rSnap = 10;
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, rSnap + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (isCenter) {
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(sp.x - 14, sp.y);
    ctx.lineTo(sp.x + 14, sp.y);
    ctx.moveTo(sp.x, sp.y - 14);
    ctx.lineTo(sp.x, sp.y + 14);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = isEndpoint ? '#22c55e' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y - rSnap);
    ctx.lineTo(sp.x + rSnap, sp.y);
    ctx.lineTo(sp.x, sp.y + rSnap);
    ctx.lineTo(sp.x - rSnap, sp.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawMeasurementTool(
  ctx: CanvasRenderingContext2D,
  measureStartPt: Point2D | null,
  measureEndPt: Point2D | null,
  currentMouseProgPt: Point2D | null,
  pan: Point2D,
  zoom: number,
  palette: CanvasPalette = LIGHT_PALETTE
) {
  if (!measureStartPt) return;

  const wToC = (x: number, y: number) => worldToCanvas(x, y, pan, zoom);

  const p1 = wToC(measureStartPt.x, measureStartPt.y);
  const targetPt = measureEndPt || currentMouseProgPt;
  if (!targetPt) return;

  const p2 = wToC(targetPt.x, targetPt.y);

  const dx = targetPt.x - measureStartPt.x;
  const dy = targetPt.y - measureStartPt.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;

  ctx.save();

  // 1. Draw dX and dY projection lines (right-angle triangle)
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)'; // Slate-500 semi-transparent
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  const cornerPt = wToC(targetPt.x, measureStartPt.y);

  // Horizontal line (dX)
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(cornerPt.x, cornerPt.y);
  ctx.stroke();

  // Vertical line (dY)
  ctx.beginPath();
  ctx.moveTo(cornerPt.x, cornerPt.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.restore();
  ctx.save();

  // 2. Main Dimension Line
  ctx.strokeStyle = '#f43f5e'; // Rose-500
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(244, 63, 94, 0.3)';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  // 3. Arrowheads or perpendicular ticks at endpoints
  const drawTick = (px: number, py: number, angle: number) => {
    const tickLen = 8;
    ctx.beginPath();
    ctx.moveTo(px - Math.sin(angle) * tickLen, py + Math.cos(angle) * tickLen);
    ctx.lineTo(px + Math.sin(angle) * tickLen, py - Math.cos(angle) * tickLen);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  drawTick(p1.x, p1.y, angleRad);
  drawTick(p2.x, p2.y, angleRad);

  // Small dots at anchors
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 4. Floating value badge at the middle of the line
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  ctx.restore();
  ctx.save();

  ctx.font = 'bold 14px monospace';
  const labelText = `${distance.toFixed(3)} мм · ${angleDeg.toFixed(1)}°`;
  const textWidth = ctx.measureText(labelText).width;
  const badgeW = textWidth + 14;
  const badgeH = 22;

  // Background box for the main distance text — white pill, dark value
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
  ctx.shadowBlur = 6;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH, 6);
  } else {
    ctx.rect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, midX, midY);

  // 5. Secondary delta dX, dY floating mini badges near their lines
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Let's place dX label in the middle of p1 and cornerPt
  if (Math.abs(dx) > 0.5) {
    const dXMidX = (p1.x + cornerPt.x) / 2;
    const dXMidY = p1.y - 12; // slightly above
    const dxText = `dX: ${Math.abs(dx).toFixed(2)}`;
    const dxW = ctx.measureText(dxText).width + 8;
    ctx.fillStyle = palette.labelChip;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(dXMidX - dxW / 2, dXMidY - 8, dxW, 16, 4);
    } else {
      ctx.rect(dXMidX - dxW / 2, dXMidY - 8, dxW, 16);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.labelText;
    ctx.fillText(dxText, dXMidX, dXMidY);
  }

  // Let's place dY label in the middle of cornerPt and p2
  if (Math.abs(dy) > 0.5) {
    const dYMidX = cornerPt.x + (dx >= 0 ? 25 : -25); // slightly right/left
    const dYMidY = (cornerPt.y + p2.y) / 2;
    const dyText = `dY: ${Math.abs(dy).toFixed(2)}`;
    const dyW = ctx.measureText(dyText).width + 8;
    ctx.fillStyle = palette.labelChip;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(dYMidX - dyW / 2, dYMidY - 8, dyW, 16, 4);
    } else {
      ctx.rect(dYMidX - dyW / 2, dYMidY - 8, dyW, 16);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.labelText;
    ctx.fillText(dyText, dYMidX, dYMidY);
  }

  ctx.restore();
}

/**
 * Renders the box selection (marquee lasso frame) on the canvas
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  boxStartPx: Point2D,
  boxCurrentPx: Point2D
) {
  const left = Math.min(boxStartPx.x, boxCurrentPx.x);
  const top = Math.min(boxStartPx.y, boxCurrentPx.y);
  const width = Math.abs(boxCurrentPx.x - boxStartPx.x);
  const height = Math.abs(boxCurrentPx.y - boxStartPx.y);

  if (width < 1 && height < 1) return;

  ctx.save();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  ctx.fillRect(left, top, width, height);
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
}

/**
 * Превью модуля «Параллельная …»: штриховые будущие копии (линии и/или дуги) + стрелка,
 * показывающая направление и величину смещения (для линий — середина→середина,
 * для дуг — стартовая точка→стартовая_point самой дальней концентрической копии).
 */
export function drawParallelPreview(
  ctx: CanvasRenderingContext2D,
  preview: ParallelPreviewState,
  pan: Point2D,
  zoom: number
) {
  const wToC = (x: number, y: number) => worldToCanvas(x, y, pan, zoom);
  const hasLines = preview.segments.length > 0;
  const arcs = preview.arcs ?? [];
  const hasArcs = arcs.length > 0;
  if (!hasLines && !hasArcs) return;

  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.fillStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  // Штриховые будущие линии.
  for (const seg of preview.segments) {
    const p1 = wToC(seg.startX, seg.startY);
    const p2 = wToC(seg.endX, seg.endY);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Штриховые будущие дуги (тот же центр/углы, радиус смещён).
  for (const a of arcs) {
    const cp = wToC(a.centerX, a.centerY);
    const rPx = a.radius * zoom;
    const pS = wToC(a.startX, a.startY);
    const pE = wToC(a.endX, a.endY);
    const ang1 = Math.atan2(pS.y - cp.y, pS.x - cp.x);
    const ang2 = Math.atan2(pE.y - cp.y, pE.x - cp.x);
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, rPx, ang1, ang2, !a.clockwise);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Стрелка направления смещения.
  let src: Point2D | null = null;
  let dst: Point2D | null = null;
  if (hasLines && preview.source) {
    src = wToC(
      (preview.source.startX + preview.source.endX) / 2,
      (preview.source.startY + preview.source.endY) / 2
    );
    const far = preview.segments[preview.segments.length - 1];
    dst = wToC((far.startX + far.endX) / 2, (far.startY + far.endY) / 2);
  } else if (hasArcs && preview.sourceArc) {
    src = wToC(preview.sourceArc.startX, preview.sourceArc.startY);
    const far = arcs[arcs.length - 1];
    dst = wToC(far.startX, far.startY);
  }

  if (src && dst) {
    const vx = dst.x - src.x;
    const vy = dst.y - src.y;
    const vlen = Math.hypot(vx, vy);
    if (vlen > 1) {
      const ux = vx / vlen;
      const uy = vy / vlen;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.stroke();
      const head = 8;
      ctx.beginPath();
      ctx.moveTo(dst.x, dst.y);
      ctx.lineTo(dst.x - head * ux - head * 0.5 * uy, dst.y - head * uy + head * 0.5 * ux);
      ctx.lineTo(dst.x - head * ux + head * 0.5 * uy, dst.y - head * uy - head * 0.5 * ux);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

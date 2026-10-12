import { Point2D, ToolpathSegment } from '../../types';
import { worldToCanvas } from './canvasUtils';

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
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
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

import { Point2D, UnderlayState } from '../../types';
import { worldToCanvas } from './canvasUtils';
import { CanvasRect } from './canvasDrawers.types';

export const UNDERLAY_HANDLE_PX = 10;

// Мир-прямоугольник подложки -> канвас-прямоугольник (учитывая инверсию осей в worldToCanvas).
export function getUnderlayCanvasRect(underlay: UnderlayState, pan: Point2D, zoom: number): CanvasRect {
  const p1 = worldToCanvas(underlay.x, underlay.y, pan, zoom);
  const p2 = worldToCanvas(underlay.x + underlay.w, underlay.y + underlay.h, pan, zoom);
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    w: Math.abs(p2.x - p1.x),
    h: Math.abs(p2.y - p1.y),
  };
}

export function drawUnderlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  underlay: UnderlayState,
  pan: Point2D,
  zoom: number
) {
  if (!img || !underlay.src || !underlay.visible) return;
  const rect = getUnderlayCanvasRect(underlay, pan, zoom);
  if (rect.w <= 0 || rect.h <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, underlay.opacity));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;

  if (!underlay.frozen) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);

    // Квадратный ручка-маркер изменения размера в нижнем-правом углу
    const s = UNDERLAY_HANDLE_PX;
    const hx = rect.x + rect.w;
    const hy = rect.y + rect.h;
    ctx.beginPath();
    ctx.rect(hx - s / 2, hy - s / 2, s, s);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

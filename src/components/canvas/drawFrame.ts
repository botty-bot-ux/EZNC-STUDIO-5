import { MachineSettings, Point2D } from '../../types';
import { normalizeMachineBounds } from '../../lib/geometry/bounds';
import { worldToCanvas } from './canvasUtils';

/**
 * Отрисовка заготовки листа ДСП на 2D-холсте.
 * Рабочее поле станка задаётся сеткой и её мягким затуханием в drawGrid.
 */
export function drawMachineBoundsAndStock(
  ctx: CanvasRenderingContext2D,
  machine: MachineSettings,
  pan: Point2D,
  zoom: number
) {
  const stock = machine.stockSheet;
  if (!stock || !stock.enabled || stock.preset === 'none' || stock.widthX <= 0 || stock.widthY <= 0) {
    return;
  }

  ctx.save();
  const stockColor = '#22c55e';
  const sP1 = worldToCanvas(-stock.widthX, -stock.widthY, pan, zoom);
  const sP2 = worldToCanvas(0, 0, pan, zoom);

  const sX = Math.min(sP1.x, sP2.x);
  const sY = Math.min(sP1.y, sP2.y);
  const sW = Math.abs(sP2.x - sP1.x);
  const sH = Math.abs(sP2.y - sP1.y);

  ctx.strokeStyle = stockColor;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(sX, sY, sW, sH);
  ctx.setLineDash([]);

  ctx.fillStyle = stockColor;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Заготовка: ${stock.widthX}×${stock.widthY} мм`, sX + 8, sY + 8);
  ctx.restore();
}

export function drawAxisOrigin(
  ctx: CanvasRenderingContext2D,
  machine: MachineSettings,
  pan: Point2D,
  zoom: number
) {
  const mb = normalizeMachineBounds(machine.bounds);
  const offX = machine.workOffset?.x ?? 0;
  const offY = machine.workOffset?.y ?? 0;

  const left = pan.x + (mb.minY - offY) * zoom;
  const right = pan.x + (mb.maxY - offY) * zoom;
  const top = pan.y + (mb.minX - offX) * zoom;
  const bottom = pan.y + (mb.maxX - offX) * zoom;

  ctx.save();

  // 1. Horizontal Axis (World X = 0 / maxX line along bottom boundary)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  // 2. Vertical Axis (World Y = 0 / maxY line along right boundary)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(right, top);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  // 3. Labels near Origin (right, bottom).
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('-X (Вверх)', right + 10, bottom - 30);

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('-Y (Влево)', right - 12, bottom + 8);

  // Work Zero blue dot at (right, bottom)
  ctx.strokeStyle = '#2563eb';
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(right, bottom, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();

  ctx.restore();
}

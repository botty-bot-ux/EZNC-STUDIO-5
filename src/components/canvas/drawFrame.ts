import { MachineSettings, Point2D } from '../../types';
import { worldToCanvas } from './canvasUtils';
import { CanvasPalette, LIGHT_PALETTE } from './canvasPalette';

export function drawMachineBoundsAndStock(
  ctx: CanvasRenderingContext2D,
  machine: MachineSettings,
  pan: Point2D,
  zoom: number,
  palette: CanvasPalette = LIGHT_PALETTE
) {
  const bounds = machine.bounds;
  const minX = Math.min(bounds.xMin, bounds.xMax);
  const maxX = Math.max(bounds.xMin, bounds.xMax);
  const minY = Math.min(bounds.yMin, bounds.yMax);
  const maxY = Math.max(bounds.yMin, bounds.yMax);

  const left = pan.x + minY * zoom;
  const right = pan.x + maxY * zoom;
  const top = pan.y + minX * zoom;
  const bottom = pan.y + maxX * zoom;

  ctx.save();

  // 1. Dashed Frame for Top (X = minX) and Left (Y = minY) Machine Boundaries
  ctx.strokeStyle = palette.frameLine; // Slate 500
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 4]);

  // Top boundary line
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.stroke();

  // Left boundary line
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.stroke();

  ctx.setLineDash([]);

  // Boundary text labels
  ctx.font = '500 13px tabular-nums, sans-serif';

  // Label at Top Boundary (xMin)
  const xMinText = `${minX} мм`;
  ctx.fillStyle = palette.labelChip;
  const xMinW = ctx.measureText(xMinText).width;
  ctx.fillRect(right - xMinW - 12, top - 8, xMinW + 8, 16);
  ctx.fillStyle = palette.labelText;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(xMinText, right - 8, top);

  // Label at Left Boundary (yMin)
  const yMinText = `${minY} мм`;
  ctx.fillStyle = palette.labelChip;
  const yMinW = ctx.measureText(yMinText).width;
  ctx.fillRect(left - 4, bottom + 8, yMinW + 8, 16);
  ctx.fillStyle = palette.labelText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(yMinText, left, bottom + 16);

  // Stock Sheet
  const stock = machine.stockSheet;
  if (stock && stock.enabled && stock.preset !== 'none' && stock.widthX > 0 && stock.widthY > 0) {
    const stockColor = '#22c55e'; // Зеленый цвет
    const sP1 = worldToCanvas(-stock.widthX, -stock.widthY, pan, zoom);
    const sP2 = worldToCanvas(0, 0, pan, zoom);

    const sX = Math.min(sP1.x, sP2.x);
    const sY = Math.min(sP1.y, sP2.y);
    const sW = Math.abs(sP2.x - sP1.x);
    const sH = Math.abs(sP2.y - sP1.y);

    // Только пунктирная линия
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
  }

  ctx.restore();
}

export function drawAxisOrigin(
  ctx: CanvasRenderingContext2D,
  machine: MachineSettings,
  pan: Point2D,
  zoom: number
) {
  const bounds = machine.bounds;
  const minX = Math.min(bounds.xMin, bounds.xMax);
  const maxX = Math.max(bounds.xMin, bounds.xMax);
  const minY = Math.min(bounds.yMin, bounds.yMax);
  const maxY = Math.max(bounds.yMin, bounds.yMax);

  const left = pan.x + minY * zoom;
  const right = pan.x + maxY * zoom;
  const top = pan.y + minX * zoom;
  const bottom = pan.y + maxX * zoom;

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
  //    Vertical green line = X axis, horizontal red line = Y axis —
  //    each label is colored to match the line it describes.
  // -X (Вверх) in green, along the vertical (X) axis
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('-X (Вверх)', right + 10, bottom - 30);

  // -Y (Влево) in red, below the horizontal (Y) axis
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

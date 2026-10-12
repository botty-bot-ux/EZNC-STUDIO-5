import { MachineSettings, Point2D } from '../../types';
import { CanvasPalette, LIGHT_PALETTE } from './canvasPalette';

export function drawWorkAreaGradientFade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  fadeDist: number = 50,
  palette: CanvasPalette = LIGHT_PALETTE
) {
  ctx.save();

  const bgColor = palette.bg;
  const transparentBg = palette.bgFade0;
  const solidBg = palette.bgFade1;

  // 1. Solid background outside the extended boundary [left - fadeDist, top - fadeDist, right + fadeDist, bottom + fadeDist]
  ctx.fillStyle = bgColor;

  // Top outer area
  if (top - fadeDist > 0) {
    ctx.fillRect(0, 0, width, Math.max(0, top - fadeDist));
  }
  // Bottom outer area
  if (bottom + fadeDist < height) {
    ctx.fillRect(0, bottom + fadeDist, width, height - (bottom + fadeDist));
  }
  // Left outer area
  if (left - fadeDist > 0) {
    ctx.fillRect(
      0,
      Math.max(0, top - fadeDist),
      left - fadeDist,
      Math.min(height, bottom + fadeDist) - Math.max(0, top - fadeDist)
    );
  }
  // Right outer area
  if (right + fadeDist < width) {
    ctx.fillRect(
      right + fadeDist,
      Math.max(0, top - fadeDist),
      width - (right + fadeDist),
      Math.min(height, bottom + fadeDist) - Math.max(0, top - fadeDist)
    );
  }

  // 2. Linear Edge Gradients
  if (right > left && fadeDist > 0) {
    // Top Edge Gradient (from top to top - fadeDist)
    const topGrad = ctx.createLinearGradient(0, top, 0, top - fadeDist);
    topGrad.addColorStop(0, transparentBg);
    topGrad.addColorStop(1, solidBg);
    ctx.fillStyle = topGrad;
    ctx.fillRect(left, top - fadeDist, right - left, fadeDist);

    // Bottom Edge Gradient (from bottom to bottom + fadeDist)
    const botGrad = ctx.createLinearGradient(0, bottom, 0, bottom + fadeDist);
    botGrad.addColorStop(0, transparentBg);
    botGrad.addColorStop(1, solidBg);
    ctx.fillStyle = botGrad;
    ctx.fillRect(left, bottom, right - left, fadeDist);

    // Left Edge Gradient (from left to left - fadeDist)
    const leftGrad = ctx.createLinearGradient(left, 0, left - fadeDist, 0);
    leftGrad.addColorStop(0, transparentBg);
    leftGrad.addColorStop(1, solidBg);
    ctx.fillStyle = leftGrad;
    ctx.fillRect(left - fadeDist, top, fadeDist, bottom - top);

    // Right Edge Gradient (from right to right + fadeDist)
    const rightGrad = ctx.createLinearGradient(right, 0, right + fadeDist, 0);
    rightGrad.addColorStop(0, transparentBg);
    rightGrad.addColorStop(1, solidBg);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(right, top, fadeDist, bottom - top);
  }

  // 3. Corner Radial Gradients
  if (fadeDist > 0) {
    // Top-Left Corner
    const tlGrad = ctx.createRadialGradient(left, top, 0, left, top, fadeDist);
    tlGrad.addColorStop(0, transparentBg);
    tlGrad.addColorStop(1, solidBg);
    ctx.fillStyle = tlGrad;
    ctx.fillRect(left - fadeDist, top - fadeDist, fadeDist, fadeDist);

    // Top-Right Corner
    const trGrad = ctx.createRadialGradient(right, top, 0, right, top, fadeDist);
    trGrad.addColorStop(0, transparentBg);
    trGrad.addColorStop(1, solidBg);
    ctx.fillStyle = trGrad;
    ctx.fillRect(right, top - fadeDist, fadeDist, fadeDist);

    // Bottom-Left Corner
    const blGrad = ctx.createRadialGradient(left, bottom, 0, left, bottom, fadeDist);
    blGrad.addColorStop(0, transparentBg);
    blGrad.addColorStop(1, solidBg);
    ctx.fillStyle = blGrad;
    ctx.fillRect(left - fadeDist, bottom, fadeDist, fadeDist);

    // Bottom-Right Corner
    const brGrad = ctx.createRadialGradient(right, bottom, 0, right, bottom, fadeDist);
    brGrad.addColorStop(0, transparentBg);
    brGrad.addColorStop(1, solidBg);
    ctx.fillStyle = brGrad;
    ctx.fillRect(right, bottom, fadeDist, fadeDist);
  }

  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: Point2D,
  zoom: number,
  gridStep: number,
  machine: MachineSettings,
  palette: CanvasPalette = LIGHT_PALETTE
) {
  ctx.save();

  // 1. Clean uniform light background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Machine Bounds in World and Canvas space
  const bounds = machine.bounds;
  const minX = Math.min(bounds.xMin, bounds.xMax);
  const maxX = Math.max(bounds.xMin, bounds.xMax);
  const minY = Math.min(bounds.yMin, bounds.yMax);
  const maxY = Math.max(bounds.yMin, bounds.yMax);

  const left = pan.x + minY * zoom;
  const right = pan.x + maxY * zoom;
  const top = pan.y + minX * zoom;
  const bottom = pan.y + maxX * zoom;

  // Fade distance in canvas pixels
  const fadeDist = Math.max(35, Math.min(80, Math.round(50 * Math.sqrt(zoom))));

  // 3. Dynamic step calculation so grid lines are comfortably spaced
  let step = gridStep || 1;
  const minPx = 15;

  while (step * zoom < minPx) {
    if (step < 5) step = 5;
    else if (step < 10) step = 10;
    else if (step < 50) step *= 2;
    else if (step < 100) step = 100;
    else step *= 2;
  }

  const majorStep = step * 5;

  // World bounds for grid lines (constrained strictly to machine bounds plus fade margin)
  const startWy = Math.floor(minY / step) * step;
  const endWy = Math.ceil(maxY / step) * step;
  const startWx = Math.floor(minX / step) * step;
  const endWx = Math.ceil(maxX / step) * step;

  // 4. Minor Grid Lines (Slate 300)
  ctx.beginPath();
  ctx.strokeStyle = palette.gridMinor;
  ctx.lineWidth = 0.8;

  // Vertical minor lines (World Y)
  for (let wy = startWy; wy <= endWy; wy += step) {
    if (Math.abs(Math.round(wy / step)) % 5 === 0) continue;
    const cx = Math.floor(pan.x + wy * zoom) + 0.5;
    if (cx >= left - fadeDist && cx <= right + fadeDist) {
      ctx.moveTo(cx, Math.max(0, top - fadeDist));
      ctx.lineTo(cx, Math.min(height, bottom + fadeDist));
    }
  }

  // Horizontal minor lines (World X)
  for (let wx = startWx; wx <= endWx; wx += step) {
    if (Math.abs(Math.round(wx / step)) % 5 === 0) continue;
    const cy = Math.floor(pan.y + wx * zoom) + 0.5;
    if (cy >= top - fadeDist && cy <= bottom + fadeDist) {
      ctx.moveTo(Math.max(0, left - fadeDist), cy);
      ctx.lineTo(Math.min(width, right + fadeDist), cy);
    }
  }
  ctx.stroke();

  // 5. Major Grid Lines (Slate 400)
  ctx.beginPath();
  ctx.strokeStyle = palette.gridMajor;
  ctx.lineWidth = 1.2;

  const startMajorWy = Math.floor(minY / majorStep) * majorStep;
  const endMajorWy = Math.ceil(maxY / majorStep) * majorStep;
  const startMajorWx = Math.floor(minX / majorStep) * majorStep;
  const endMajorWx = Math.ceil(maxX / majorStep) * majorStep;

  // Vertical major lines (World Y)
  for (let wy = startMajorWy; wy <= endMajorWy; wy += majorStep) {
    const cx = Math.floor(pan.x + wy * zoom) + 0.5;
    if (cx >= left - fadeDist && cx <= right + fadeDist) {
      ctx.moveTo(cx, Math.max(0, top - fadeDist));
      ctx.lineTo(cx, Math.min(height, bottom + fadeDist));
    }
  }

  // Horizontal major lines (World X)
  for (let wx = startMajorWx; wx <= endMajorWx; wx += majorStep) {
    const cy = Math.floor(pan.y + wx * zoom) + 0.5;
    if (cy >= top - fadeDist && cy <= bottom + fadeDist) {
      ctx.moveTo(Math.max(0, left - fadeDist), cy);
      ctx.lineTo(Math.min(width, right + fadeDist), cy);
    }
  }
  ctx.stroke();

  // 6. Smooth Vanishing Gradient Mask
  drawWorkAreaGradientFade(ctx, width, height, left, top, right, bottom, fadeDist, palette);

  // 7. Dimension labels with "мм" spaced out along grid axes
  if (zoom > 0.1) {
    ctx.font = '500 13px tabular-nums, sans-serif';

    // Dimension labels along Y axis (Horizontal axis at bottom)
    const yLabelCanvasY = Math.min(Math.max(bottom + 16, 22), height - 22);

    for (let wy = startMajorWy; wy <= endMajorWy; wy += majorStep) {
      if (wy === 0) continue;
      const cx = pan.x + wy * zoom;
      if (cx >= left - 10 && cx <= right + 10 && cx >= 35 && cx <= width - 35) {
        const labelText = `${wy} мм`;

        ctx.fillStyle = palette.labelChip;
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillRect(cx - textWidth / 2 - 3, yLabelCanvasY - 9, textWidth + 6, 14);

        ctx.fillStyle = palette.labelText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, cx, yLabelCanvasY - 2);
      }
    }

    // Dimension labels along X axis (Vertical axis at right)
    const xLabelCanvasX = Math.min(Math.max(right + 10, 10), width - 65);

    for (let wx = startMajorWx; wx <= endMajorWx; wx += majorStep) {
      if (wx === 0) continue;
      const cy = pan.y + wx * zoom;
      if (cy >= top - 10 && cy <= bottom + 10 && cy >= 25 && cy <= height - 22) {
        const labelText = `${wx} мм`;

        ctx.fillStyle = palette.labelChip;
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillRect(xLabelCanvasX - 2, cy - 7, textWidth + 6, 14);

        ctx.fillStyle = palette.labelText;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, xLabelCanvasX + 1, cy);
      }
    }
  }

  ctx.restore();
}

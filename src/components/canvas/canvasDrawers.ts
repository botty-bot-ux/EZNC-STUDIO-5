import { ActiveTool, CADObject, MachineSettings, Point2D, ToolpathSegment, ViewMode } from '../../types';
import { DragMode } from './canvasHitTest';
import { HoveredHandle, SnapPointInfo, canvasToWorld, getArcFrom3Points, worldToCanvas } from './canvasUtils';

export interface DrawOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pan: Point2D;
  zoom: number;
  gridStep: number;
  machine: MachineSettings;
  objects: CADObject[];
  selectedObjectId: string | null;
  toolpathSegments: ToolpathSegment[];
  viewMode: ViewMode;
  activeTool: ActiveTool;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  currentMouseProgPt: Point2D | null;
  dragMode: DragMode;
  hoveredHandle: HoveredHandle | null;
  activeSnapInfo: SnapPointInfo | null;
}

export function drawWorkAreaGradientFade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  fadeDist: number = 50
) {
  ctx.save();

  const bgColor = '#f8fafc';
  const transparentBg = 'rgba(248, 250, 252, 0)';
  const solidBg = 'rgba(248, 250, 252, 1)';

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
  machine: MachineSettings
) {
  ctx.save();

  // 1. Clean uniform light background
  ctx.fillStyle = '#f8fafc';
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
  ctx.strokeStyle = '#cbd5e1';
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
  ctx.strokeStyle = '#94a3b8';
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
  drawWorkAreaGradientFade(ctx, width, height, left, top, right, bottom, fadeDist);

  // 7. Dimension labels with "мм" spaced out along grid axes
  if (zoom > 0.1) {
    ctx.font = '500 11px tabular-nums, sans-serif';

    // Dimension labels along Y axis (Horizontal axis at bottom)
    const yLabelCanvasY = Math.min(Math.max(bottom + 16, 22), height - 22);

    for (let wy = startMajorWy; wy <= endMajorWy; wy += majorStep) {
      if (wy === 0) continue;
      const cx = pan.x + wy * zoom;
      if (cx >= left - 10 && cx <= right + 10 && cx >= 35 && cx <= width - 35) {
        const labelText = `${wy} мм`;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillRect(cx - textWidth / 2 - 3, yLabelCanvasY - 9, textWidth + 6, 14);

        ctx.fillStyle = '#475569';
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

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillRect(xLabelCanvasX - 2, cy - 7, textWidth + 6, 14);

        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, xLabelCanvasX + 1, cy);
      }
    }
  }

  ctx.restore();
}

export function drawMachineBoundsAndStock(
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

  // 1. Dashed Frame for Top (X = minX) and Left (Y = minY) Machine Boundaries
  ctx.strokeStyle = '#64748b'; // Slate 500
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
  ctx.font = '500 11px tabular-nums, sans-serif';

  // Label at Top Boundary (xMin)
  const xMinText = `${minX} мм`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const xMinW = ctx.measureText(xMinText).width;
  ctx.fillRect(right - xMinW - 12, top - 8, xMinW + 8, 16);
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(xMinText, right - 8, top);

  // Label at Left Boundary (yMin)
  const yMinText = `${minY} мм`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const yMinW = ctx.measureText(yMinText).width;
  ctx.fillRect(left - 4, bottom + 8, yMinW + 8, 16);
  ctx.fillStyle = '#475569';
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
    ctx.font = 'bold 11px monospace';
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

  // 3. Labels near Origin (right, bottom):
  // -X (Вверх) in red next to green axis
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('-X (Вверх)', right + 10, bottom - 30);

  // -Y (Влево) in green next to red axis
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('-Y (Влево)', right - 12, bottom - 8);

  // Work Zero blue dot at (right, bottom)
  ctx.strokeStyle = '#2563eb';
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(right, bottom, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();

  // Badge (0,0)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fillRect(right + 6, bottom + 6, 36, 16);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(right + 6, bottom + 6, 36, 16);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 10px tabular-nums, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('(0,0)', right + 9, bottom + 8);

  ctx.restore();
}

export function drawToolpathSegments(
  ctx: CanvasRenderingContext2D,
  segments: ToolpathSegment[],
  pan: Point2D,
  zoom: number
) {
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
}

export function drawCADObjects(
  ctx: CanvasRenderingContext2D,
  objects: CADObject[],
  selectedObjectIds: string[] | string | null,
  hoveredHandle: HoveredHandle | null,
  dragMode: DragMode,
  pan: Point2D,
  zoom: number,
  toolDiameter?: number
) {
  const selArray = Array.isArray(selectedObjectIds)
    ? selectedObjectIds
    : selectedObjectIds
    ? [selectedObjectIds]
    : [];
  const wToC = (x: number, y: number) => worldToCanvas(x, y, pan, zoom);

  // 1. TOOL CUTTER MARGIN LAYER (Semi-transparent gray band showing tool diameter)
  if (toolDiameter && toolDiameter > 0) {
    const toolPx = toolDiameter * zoom;
    if (toolPx > 0.5) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const obj of objects) {
        if (obj.visible === false) continue;
        const isSelected = selArray.includes(obj.id);
        const isHoveredObj = hoveredHandle?.objectId === obj.id;

        const cutterColor = isSelected
          ? 'rgba(37, 99, 235, 0.22)'
          : isHoveredObj
          ? 'rgba(59, 130, 246, 0.20)'
          : 'rgba(100, 116, 139, 0.22)';

        ctx.strokeStyle = cutterColor;
        ctx.lineWidth = toolPx;

        if (obj.type === 'line') {
          const p1 = wToC(obj.startX, obj.startY);
          const p2 = wToC(obj.endX, obj.endY);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        } else if (obj.type === 'polyline') {
          if (obj.points && obj.points.length >= 2) {
            const pts = obj.points.map((p) => wToC(p.x, p.y));
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo(pts[i].x, pts[i].y);
            }
            if (obj.closed) ctx.closePath();
            ctx.stroke();
          }
        } else if (obj.type === 'rectangle') {
          const p1 = wToC(obj.x, obj.y);
          const p2 = wToC(obj.x + obj.width, obj.y + obj.height);
          const minX = Math.min(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const wPx = Math.abs(p2.x - p1.x);
          const hPx = Math.abs(p2.y - p1.y);
          ctx.strokeRect(minX, minY, wPx, hPx);
        } else if (obj.type === 'circle') {
          const cp = wToC(obj.centerX, obj.centerY);
          const rPx = obj.radius * zoom;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
          ctx.stroke();
        } else if (obj.type === 'arc') {
          const cp = wToC(obj.centerX, obj.centerY);
          const rPx = obj.radius * zoom;
          const pStart = wToC(obj.startX, obj.startY);
          const pEnd = wToC(obj.endX, obj.endY);
          const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
          const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, rPx, a1, a2, !obj.clockwise);
          ctx.stroke();
        } else if (obj.type === 'point') {
          const cp = wToC(obj.x, obj.y);
          const rPx = (toolDiameter / 2) * zoom;
          ctx.fillStyle = cutterColor;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  for (const obj of objects) {
    if (obj.visible === false) continue;
    const isSelected = selArray.includes(obj.id);
    const isHoveredObj = hoveredHandle?.objectId === obj.id;

    ctx.lineWidth = isSelected ? 2.8 : isHoveredObj ? 2.5 : 2;
    ctx.strokeStyle = isSelected ? '#2563eb' : isHoveredObj ? '#3b82f6' : '#0f172a';

    if (obj.type === 'point') {
      const cp = wToC(obj.x, obj.y);
      const rPx = Math.max(5, (obj.diameter / 2) * zoom);

      ctx.beginPath();
      ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isSelected ? '#2563eb' : '#0f172a';
      ctx.beginPath();
      ctx.moveTo(cp.x - rPx - 4, cp.y);
      ctx.lineTo(cp.x + rPx + 4, cp.y);
      ctx.moveTo(cp.x, cp.y - rPx - 4);
      ctx.lineTo(cp.x, cp.y + rPx + 4);
      ctx.stroke();

      // Vertex center dot
      ctx.fillStyle = isSelected ? '#2563eb' : '#0f172a';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(`${obj.name} (Ø${obj.diameter})`, cp.x + rPx + 6, cp.y - 4);
      }
    } else if (obj.type === 'line') {
      const p1 = wToC(obj.startX, obj.startY);
      const p2 = wToC(obj.endX, obj.endY);

      // Line stroke
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const lineLen = Math.hypot(obj.endX - obj.startX, obj.endY - obj.startY);
      const midPx = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      if (isSelected || isHoveredObj) {
        ctx.fillStyle = isSelected ? '#1e293b' : '#3b82f6';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(`${lineLen.toFixed(1)} мм`, midPx.x + 8, midPx.y - 8);
      }

      // Vertex dots at endpoints (crisp black dots as in reference image)
      if (!isSelected && !isHoveredObj) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 3.5, 0, Math.PI * 2);
        ctx.arc(p2.x, p2.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // START HANDLE (POINT 1)
        const isStartHovered = isHoveredObj && hoveredHandle?.type === 'line_start';
        const isStartActive = dragMode === 'line_start' && isSelected;
        const rStart = isStartActive ? 10 : isStartHovered ? 8 : isSelected ? 7 : 5;

        if (isStartHovered || isStartActive || isSelected) {
          ctx.fillStyle = isStartActive || isStartHovered ? 'rgba(34, 197, 94, 0.35)' : 'rgba(37, 99, 235, 0.18)';
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, rStart + 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isStartActive ? '#4ade80' : isStartHovered ? '#22c55e' : isSelected ? '#2563eb' : '#0f172a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, rStart, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isSelected || isStartHovered || isStartActive) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('1', p1.x, p1.y);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }

        // END HANDLE (POINT 2)
        const isEndHovered = isHoveredObj && hoveredHandle?.type === 'line_end';
        const isEndActive = dragMode === 'line_end' && isSelected;
        const rEnd = isEndActive ? 10 : isEndHovered ? 8 : isSelected ? 7 : 5;

        if (isEndHovered || isEndActive || isSelected) {
          ctx.fillStyle = isEndActive || isEndHovered ? 'rgba(239, 68, 68, 0.35)' : 'rgba(37, 99, 235, 0.18)';
          ctx.beginPath();
          ctx.arc(p2.x, p2.y, rEnd + 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isEndActive ? '#f87171' : isEndHovered ? '#ef4444' : isSelected ? '#dc2626' : '#0f172a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, rEnd, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isSelected || isEndHovered || isEndActive) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('2', p2.x, p2.y);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }
    } else if (obj.type === 'polyline') {
      if (obj.points && obj.points.length >= 2) {
        const pts = obj.points.map((p) => wToC(p.x, p.y));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        if (obj.closed) ctx.closePath();
        ctx.stroke();

        pts.forEach((pt, idx) => {
          const isPtHovered = isHoveredObj && hoveredHandle?.type === 'polyline_point' && hoveredHandle.pointIndex === idx;
          ctx.fillStyle = isPtHovered ? '#f59e0b' : isSelected ? '#2563eb' : '#0f172a';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    } else if (obj.type === 'rectangle') {
      const p1 = wToC(obj.x, obj.y);
      const p2 = wToC(obj.x + obj.width, obj.y + obj.height);

      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const wPx = Math.abs(p2.x - p1.x);
      const hPx = Math.abs(p2.y - p1.y);

      ctx.strokeRect(minX, minY, wPx, hPx);

      if (isSelected) {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.06)';
        ctx.fillRect(minX, minY, wPx, hPx);
      }

      // Vertex dots at 4 corners
      ctx.fillStyle = isSelected ? '#2563eb' : '#0f172a';
      ctx.beginPath();
      ctx.arc(minX, minY, 3.5, 0, Math.PI * 2);
      ctx.arc(minX + wPx, minY, 3.5, 0, Math.PI * 2);
      ctx.arc(minX + wPx, minY + hPx, 3.5, 0, Math.PI * 2);
      ctx.arc(minX, minY + hPx, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (obj.type === 'circle') {
      const cp = wToC(obj.centerX, obj.centerY);
      const rPx = obj.radius * zoom;

      ctx.beginPath();
      ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = isSelected ? '#2563eb' : '#0f172a';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.06)';
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (obj.type === 'arc') {
      const cp = wToC(obj.centerX, obj.centerY);
      const rPx = obj.radius * zoom;
      const pStart = wToC(obj.startX, obj.startY);
      const pEnd = wToC(obj.endX, obj.endY);

      const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
      const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);

      ctx.beginPath();
      ctx.arc(cp.x, cp.y, rPx, a1, a2, !obj.clockwise);
      ctx.stroke();

      // Endpoints & center dots
      ctx.fillStyle = isSelected ? '#2563eb' : '#0f172a';
      ctx.beginPath();
      ctx.arc(pStart.x, pStart.y, 3.5, 0, Math.PI * 2);
      ctx.arc(pEnd.x, pEnd.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected || isHoveredObj) {
        const isStartHovered = isHoveredObj && hoveredHandle?.type === 'arc_start';
        ctx.fillStyle = isStartHovered ? '#f59e0b' : '#22c55e';
        ctx.beginPath();
        ctx.arc(pStart.x, pStart.y, 5, 0, Math.PI * 2);
        ctx.fill();

        const isEndHovered = isHoveredObj && hoveredHandle?.type === 'arc_end';
        ctx.fillStyle = isEndHovered ? '#f59e0b' : '#ef4444';
        ctx.beginPath();
        ctx.arc(pEnd.x, pEnd.y, 5, 0, Math.PI * 2);
        ctx.fill();

        const isCenterHovered = isHoveredObj && hoveredHandle?.type === 'arc_center';
        ctx.fillStyle = isCenterHovered ? '#f59e0b' : '#0284c7';
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function drawDrawingPreview(
  ctx: CanvasRenderingContext2D,
  activeTool: ActiveTool,
  drawStartPt: Point2D | null,
  drawArcStartPt: Point2D | null,
  drawArcEndPt: Point2D | null,
  currentMouseProgPt: Point2D | null,
  pan: Point2D,
  zoom: number,
  toolDiameter?: number
) {
  if (activeTool === 'select' || !currentMouseProgPt) return;

  const wToC = (x: number, y: number) => worldToCanvas(x, y, pan, zoom);

  // Draw tool diameter preview band
  if (toolDiameter && toolDiameter > 0) {
    const toolPx = toolDiameter * zoom;
    if (toolPx > 0.5) {
      ctx.save();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.20)';
      ctx.lineWidth = toolPx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'line' && drawStartPt) {
        const p1 = wToC(drawStartPt.x, drawStartPt.y);
        const p2 = wToC(currentMouseProgPt.x, currentMouseProgPt.y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (activeTool === 'rectangle' && drawStartPt) {
        const p1 = wToC(drawStartPt.x, drawStartPt.y);
        const p2 = wToC(currentMouseProgPt.x, currentMouseProgPt.y);
        ctx.strokeRect(
          Math.min(p1.x, p2.x),
          Math.min(p1.y, p2.y),
          Math.abs(p2.x - p1.x),
          Math.abs(p2.y - p1.y)
        );
      } else if (activeTool === 'circle' && drawStartPt) {
        const p1 = wToC(drawStartPt.x, drawStartPt.y);
        const dx = currentMouseProgPt.x - drawStartPt.x;
        const dy = currentMouseProgPt.y - drawStartPt.y;
        const r = Math.hypot(dx, dy);
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, r * zoom, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === 'arc' && drawArcStartPt && drawArcEndPt) {
        const arcData = getArcFrom3Points(drawArcStartPt, drawArcEndPt, currentMouseProgPt);
        const cp = wToC(arcData.centerX, arcData.centerY);
        const rPx = arcData.radius * zoom;
        const pStart = wToC(drawArcStartPt.x, drawArcStartPt.y);
        const pEnd = wToC(drawArcEndPt.x, drawArcEndPt.y);

        const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
        const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);

        ctx.beginPath();
        ctx.arc(cp.x, cp.y, rPx, a1, a2, !arcData.clockwise);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  if (activeTool === 'arc') {
    if (drawArcStartPt && !drawArcEndPt) {
      const p1 = wToC(drawArcStartPt.x, drawArcStartPt.y);
      const p2 = wToC(currentMouseProgPt.x, currentMouseProgPt.y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (drawArcStartPt && drawArcEndPt) {
      const arcData = getArcFrom3Points(drawArcStartPt, drawArcEndPt, currentMouseProgPt);
      const cp = wToC(arcData.centerX, arcData.centerY);
      const rPx = arcData.radius * zoom;
      const pStart = wToC(drawArcStartPt.x, drawArcStartPt.y);
      const pEnd = wToC(drawArcEndPt.x, drawArcEndPt.y);

      const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
      const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);

      ctx.beginPath();
      ctx.arc(cp.x, cp.y, rPx, a1, a2, !arcData.clockwise);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (drawStartPt) {
    const p1 = wToC(drawStartPt.x, drawStartPt.y);
    const p2 = wToC(currentMouseProgPt.x, currentMouseProgPt.y);

    if (activeTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (activeTool === 'rectangle') {
      ctx.strokeRect(
        Math.min(p1.x, p2.x),
        Math.min(p1.y, p2.y),
        Math.abs(p2.x - p1.x),
        Math.abs(p2.y - p1.y)
      );
    } else if (activeTool === 'circle') {
      const dx = currentMouseProgPt.x - drawStartPt.x;
      const dy = currentMouseProgPt.y - drawStartPt.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, r * zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
}

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

  // Draw snap label badge
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  const labelText = `🧲 ${activeSnapInfo.label}`;
  const textWidth = ctx.measureText(labelText).width;
  const bgW = textWidth + 18;
  const bgH = 22;
  const bgX = sp.x - bgW / 2;
  const bgY = sp.y - 34;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = isCenter ? '#f59e0b' : isEndpoint ? '#22c55e' : '#38bdf8';
  ctx.lineWidth = 1;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(bgX, bgY, bgW, bgH, 6);
  } else {
    ctx.rect(bgX, bgY, bgW, bgH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, sp.x, bgY + bgH / 2);

  ctx.restore();
}

export function drawMeasurementTool(
  ctx: CanvasRenderingContext2D,
  measureStartPt: Point2D | null,
  measureEndPt: Point2D | null,
  currentMouseProgPt: Point2D | null,
  pan: Point2D,
  zoom: number
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

  ctx.font = 'bold 12px monospace';
  const labelText = `${distance.toFixed(3)} мм`;
  const textWidth = ctx.measureText(labelText).width;
  const badgeW = textWidth + 14;
  const badgeH = 22;

  // Background box for the main distance text
  ctx.fillStyle = '#0f172a'; // Deep Slate-900
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
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, midX, midY);

  // 5. Secondary delta dX, dY floating mini badges near their lines
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Let's place dX label in the middle of p1 and cornerPt
  if (Math.abs(dx) > 0.5) {
    const dXMidX = (p1.x + cornerPt.x) / 2;
    const dXMidY = p1.y - 12; // slightly above
    const dxText = `dX: ${Math.abs(dx).toFixed(2)}`;
    const dxW = ctx.measureText(dxText).width + 8;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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
    ctx.fillStyle = '#475569';
    ctx.fillText(dxText, dXMidX, dXMidY);
  }

  // Let's place dY label in the middle of cornerPt and p2
  if (Math.abs(dy) > 0.5) {
    const dYMidX = cornerPt.x + (dx >= 0 ? 25 : -25); // slightly right/left
    const dYMidY = (cornerPt.y + p2.y) / 2;
    const dyText = `dY: ${Math.abs(dy).toFixed(2)}`;
    const dyW = ctx.measureText(dyText).width + 8;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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
    ctx.fillStyle = '#475569';
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

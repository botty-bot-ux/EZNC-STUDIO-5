import { CADObject, Point2D } from '../../types';
import { DragMode } from './canvasHitTest';
import { HoveredHandle, worldToCanvas } from './canvasUtils';
import { CanvasPalette, LIGHT_PALETTE } from './canvasPalette';

export function drawCADObjects(
  ctx: CanvasRenderingContext2D,
  objects: CADObject[],
  selectedObjectIds: string[] | string | null,
  hoveredHandle: HoveredHandle | null,
  dragMode: DragMode,
  pan: Point2D,
  zoom: number,
  toolDiameter?: number,
  palette: CanvasPalette = LIGHT_PALETTE
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
    ctx.strokeStyle = isSelected ? '#2563eb' : isHoveredObj ? '#3b82f6' : palette.objectIdle;

    if (obj.type === 'point') {
      const cp = wToC(obj.x, obj.y);
      const rPx = Math.max(5, (obj.diameter / 2) * zoom);

      ctx.beginPath();
      ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isSelected ? '#2563eb' : palette.objectIdle;
      ctx.beginPath();
      ctx.moveTo(cp.x - rPx - 4, cp.y);
      ctx.lineTo(cp.x + rPx + 4, cp.y);
      ctx.moveTo(cp.x, cp.y - rPx - 4);
      ctx.lineTo(cp.x, cp.y + rPx + 4);
      ctx.stroke();

      // Vertex center dot
      ctx.fillStyle = isSelected ? '#2563eb' : palette.objectIdle;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.fillStyle = palette.labelTextStrong;
        ctx.font = 'bold 13px system-ui, sans-serif';
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
        ctx.fillStyle = isSelected ? palette.labelTextStrong : '#3b82f6';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(`${lineLen.toFixed(1)} мм`, midPx.x + 8, midPx.y - 8);
      }

      // Vertex dots at endpoints (crisp black dots as in reference image)
      if (!isSelected && !isHoveredObj) {
        ctx.fillStyle = palette.objectIdle;
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

        ctx.fillStyle = isStartActive ? '#4ade80' : isStartHovered ? '#22c55e' : isSelected ? '#2563eb' : palette.objectIdle;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, rStart, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isSelected || isStartHovered || isStartActive) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
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
          ctx.font = 'bold 11px monospace';
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
          ctx.fillStyle = isPtHovered ? '#f59e0b' : isSelected ? '#2563eb' : palette.objectIdle;
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
      ctx.fillStyle = isSelected ? '#2563eb' : palette.objectIdle;
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
      ctx.fillStyle = isSelected ? '#2563eb' : palette.objectIdle;
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
      ctx.fillStyle = isSelected ? '#2563eb' : palette.objectIdle;
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

    // Замороженная фигура: значок-замок, чтобы было видно, что её нельзя двигать на холсте.
    if (obj.frozen) {
      let ax = 0;
      let ay = 0;
      if (obj.type === 'point') {
        ax = obj.x;
        ay = obj.y;
      } else if (obj.type === 'line') {
        ax = (obj.startX + obj.endX) / 2;
        ay = (obj.startY + obj.endY) / 2;
      } else if (obj.type === 'rectangle') {
        ax = obj.x + obj.width / 2;
        ay = obj.y + obj.height / 2;
      } else if (obj.type === 'circle') {
        ax = obj.centerX;
        ay = obj.centerY;
      } else if (obj.type === 'arc') {
        ax = (obj.startX + obj.endX) / 2;
        ay = (obj.startY + obj.endY) / 2;
      } else if (obj.type === 'polyline' && obj.points && obj.points.length > 0) {
        ax = obj.points[0].x;
        ay = obj.points[0].y;
      }
      const bp = wToC(ax, ay);

      // Компактный значок-замок без надписи: синий кружок с белым замком.
      ctx.save();
      const r = 9;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      // Дужка замка
      ctx.beginPath();
      ctx.arc(bp.x, bp.y - 1.5, 3, Math.PI, 0);
      ctx.stroke();
      // Корпус замка
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bp.x - 4, bp.y - 1.5, 8, 6.5, 1.5);
      } else {
        ctx.rect(bp.x - 4, bp.y - 1.5, 8, 6.5);
      }
      ctx.fill();
      ctx.restore();
    }
  }
}

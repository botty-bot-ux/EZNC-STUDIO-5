import { ActiveTool, ArcMode, LineMode, Point2D } from '../../types';
import { buildArc, worldToCanvas } from './canvasUtils';

export function drawDrawingPreview(
  ctx: CanvasRenderingContext2D,
  activeTool: ActiveTool,
  drawStartPt: Point2D | null,
  drawArcStartPt: Point2D | null,
  drawArcEndPt: Point2D | null,
  currentMouseProgPt: Point2D | null,
  pan: Point2D,
  zoom: number,
  arcMode: ArcMode,
  lineMode: LineMode,
  polyPts: Point2D[],
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
        const arcData = buildArc(arcMode, drawArcStartPt, drawArcEndPt, currentMouseProgPt);
        if (arcData) {
          const cp = wToC(arcData.centerX, arcData.centerY);
          const rPx = arcData.radius * zoom;
          const pStart = wToC(arcData.startX, arcData.startY);
          const pEnd = wToC(arcData.endX, arcData.endY);

          const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
          const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);

          ctx.beginPath();
          ctx.arc(cp.x, cp.y, rPx, a1, a2, !arcData.clockwise);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  ctx.save();
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
      // Для режима «центр» показываем окружность будущего радиуса, пока выбираем центр.
      if (arcMode === 'center') {
        const r = Math.hypot(currentMouseProgPt.x - drawArcStartPt.x, currentMouseProgPt.y - drawArcStartPt.y);
        if (r > 1e-4) {
          ctx.save();
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, r * zoom, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    } else if (drawArcStartPt && drawArcEndPt) {
      const arcData = buildArc(arcMode, drawArcStartPt, drawArcEndPt, currentMouseProgPt);
      if (arcData) {
        const cp = wToC(arcData.centerX, arcData.centerY);
        const rPx = arcData.radius * zoom;
        const pStart = wToC(arcData.startX, arcData.startY);
        const pEnd = wToC(arcData.endX, arcData.endY);

        const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
        const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);

        // Для режима «центр» — вся направляющая окружность.
        if (arcData.guideCenter) {
          const gc = wToC(arcData.guideCenter.x, arcData.guideCenter.y);
          ctx.save();
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.beginPath();
          ctx.arc(gc.x, gc.y, rPx, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(gc.x, gc.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(cp.x, cp.y, rPx, a1, a2, !arcData.clockwise);
        ctx.stroke();

        // Маркер точки «под курсором» (вершина горба / средняя точка дуги).
        if (arcData.apex) {
          const apex = wToC(arcData.apex.x, arcData.apex.y);
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(apex.x, apex.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (activeTool === 'line' && lineMode !== 'line' && polyPts.length > 0) {
    const pts = polyPts.map((p) => wToC(p.x, p.y));
    const mouse = wToC(currentMouseProgPt.x, currentMouseProgPt.y);
    // Уже набранные звенья.
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    // Резинка от последнего узла к курсору.
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
    // Для контура — подсказка замыкания к первой точке.
    if (lineMode === 'polygon' && pts.length >= 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.beginPath();
      ctx.moveTo(mouse.x, mouse.y);
      ctx.lineTo(pts[0].x, pts[0].y);
      ctx.stroke();
      ctx.restore();
    }
    // Узлы.
    ctx.fillStyle = '#f43f5e';
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
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

  ctx.restore();
}

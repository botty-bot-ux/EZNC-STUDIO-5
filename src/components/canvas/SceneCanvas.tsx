import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Grid,
  Maximize,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Magnet,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { CADObject, LineObject, ArcObject, Point2D } from '../../types';

interface SceneCanvasProps {
  onCursorMove: (pos: Point2D | null) => void;
}

type DragMode =
  | 'none'
  | 'pan'
  | 'object'
  | 'line_start'
  | 'line_end'
  | 'polyline_point'
  | 'arc_start'
  | 'arc_end'
  | 'arc_center';

interface HoveredHandle {
  objectId: string;
  type: 'line_start' | 'line_end' | 'polyline_point' | 'arc_start' | 'arc_end' | 'arc_center' | 'body';
  pointIndex?: number;
}

// Helper to calculate arc center, radius and direction from 3 points
function getArcFrom3Points(p1: Point2D, p2: Point2D, p3: Point2D) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-4) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radius = Math.hypot(x2 - x1, y2 - y1) / 2 || 10;
    return { centerX, centerY, radius, clockwise: true };
  }

  const centerX =
    ((x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2)) /
    D;

  const centerY =
    ((x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1)) /
    D;

  const radius = Math.hypot(x1 - centerX, y1 - centerY);
  const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const clockwise = cross < 0;

  return { centerX, centerY, radius, clockwise };
}

interface SnapPointInfo {
  x: number;
  y: number;
  label: string;
  type: 'endpoint' | 'center' | 'midpoint' | 'corner';
  objectId: string;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({ onCursorMove }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    machine,
    objects,
    selectedObjectId,
    setSelectedObjectId,
    activeTool,
    setActiveTool,
    addObject,
    updateObject,
    recordHistory,
    toolpathSegments,
    viewMode,
  } = useProjectStore();

  // Pan and Zoom viewport state
  const [zoom, setZoom] = useState<number>(0.8); // 0.8 pixels per mm
  const [pan, setPan] = useState<Point2D>({ x: 120, y: 400 }); // canvas offset in px
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [objectSnapEnabled, setObjectSnapEnabled] = useState<boolean>(true);
  const [gridStep, setGridStep] = useState<number>(10); // 10mm grid

  // Interaction temp state for drawing and handle dragging
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<Point2D>({ x: 0, y: 0 });
  const [drawStartPt, setDrawStartPt] = useState<Point2D | null>(null);
  const [drawArcStartPt, setDrawArcStartPt] = useState<Point2D | null>(null);
  const [drawArcEndPt, setDrawArcEndPt] = useState<Point2D | null>(null);
  const [currentMouseProgPt, setCurrentMouseProgPt] = useState<Point2D | null>(null);

  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStartMousePt, setDragStartMousePt] = useState<Point2D | null>(null);
  const [dragStartObjPos, setDragStartObjPos] = useState<any>(null);

  const [hoveredHandle, setHoveredHandle] = useState<HoveredHandle | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);
  const [activeSnapInfo, setActiveSnapInfo] = useState<SnapPointInfo | null>(null);

  // Keyboard events (Shift key detection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Escape') {
        setDrawStartPt(null);
        setDrawArcStartPt(null);
        setDrawArcEndPt(null);
        setActiveTool('select');
        setDragMode('none');
        setActiveSnapInfo(null);
      }
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        const k = e.key.toLowerCase();
        if (k === 'a') setActiveTool('arc');
        if (k === 's') setActiveTool('select');
        if (k === 'h') setActiveTool('point');
        if (k === 'l') setActiveTool('line');
        if (k === 'r') setActiveTool('rectangle');
        if (k === 'c') setActiveTool('circle');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setActiveTool]);

  // Convert World mm to Canvas px
  const worldToCanvas = useCallback(
    (wx: number, wy: number): Point2D => {
      return {
        x: pan.x + wy * zoom,
        y: pan.y + wx * zoom,
      };
    },
    [pan, zoom]
  );

  // Convert Canvas px to World mm
  const canvasToWorld = useCallback(
    (cx: number, cy: number): Point2D => {
      return {
        x: (cy - pan.y) / zoom,
        y: (cx - pan.x) / zoom,
      };
    },
    [pan, zoom]
  );

  // Snap coordinate to grid
  const applyGridSnap = useCallback(
    (pt: Point2D): Point2D => {
      if (!snapToGrid) return pt;
      return {
        x: Math.round(pt.x / gridStep) * gridStep,
        y: Math.round(pt.y / gridStep) * gridStep,
      };
    },
    [snapToGrid, gridStep]
  );

  // Smart Object Snapping (O-SNAP to line endpoints, hole centers, circle centers, etc.)
  const findMagneticSnapPoint = useCallback(
    (
      rawWorldPt: Point2D,
      mousePx: Point2D,
      excludeObjectId?: string,
      excludeHandleType?: DragMode
    ): { point: Point2D; snapInfo: SnapPointInfo | null } => {
      if (!objectSnapEnabled) {
        return { point: applyGridSnap(rawWorldPt), snapInfo: null };
      }

      const snapRadiusPx = 22; // 22px magnetic snap zone
      let closestSnap: SnapPointInfo | null = null;
      let minDistancePx = snapRadiusPx;

      for (const obj of objects) {
        if (obj.visible === false) continue;

        const candidates: { x: number; y: number; label: string; type: SnapPointInfo['type'] }[] = [];

        if (obj.type === 'point') {
          // Hole / point center
          candidates.push({
            x: obj.x,
            y: obj.y,
            label: `Центр отверстия (${obj.name || 'Ø11мм'})`,
            type: 'center',
          });
        } else if (obj.type === 'circle') {
          // Circle center
          candidates.push({
            x: obj.centerX,
            y: obj.centerY,
            label: `Центр окружности R${obj.radius}`,
            type: 'center',
          });
        } else if (obj.type === 'line') {
          // Line endpoints and midpoint
          const isSameObj = obj.id === excludeObjectId;

          if (!isSameObj || excludeHandleType !== 'line_start') {
            candidates.push({
              x: obj.startX,
              y: obj.startY,
              label: 'Конец линии (Точка 1)',
              type: 'endpoint',
            });
          }
          if (!isSameObj || excludeHandleType !== 'line_end') {
            candidates.push({
              x: obj.endX,
              y: obj.endY,
              label: 'Конец линии (Точка 2)',
              type: 'endpoint',
            });
          }
          if (!isSameObj) {
            candidates.push({
              x: (obj.startX + obj.endX) / 2,
              y: (obj.startY + obj.endY) / 2,
              label: 'Середина линии',
              type: 'midpoint',
            });
          }
        } else if (obj.type === 'rectangle') {
          candidates.push(
            { x: obj.x, y: obj.y, label: 'Угол прямоугольника', type: 'corner' },
            { x: obj.x + obj.width, y: obj.y, label: 'Угол прямоугольника', type: 'corner' },
            { x: obj.x, y: obj.y + obj.height, label: 'Угол прямоугольника', type: 'corner' },
            { x: obj.x + obj.width, y: obj.y + obj.height, label: 'Угол прямоугольника', type: 'corner' },
            { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2, label: 'Центр прямоугольника', type: 'center' }
          );
        } else if (obj.type === 'polyline' && obj.points) {
          obj.points.forEach((p, idx) => {
            candidates.push({
              x: p.x,
              y: p.y,
              label: `Узел полилинии #${idx + 1}`,
              type: 'endpoint',
            });
          });
        } else if (obj.type === 'arc') {
          candidates.push(
            { x: obj.startX, y: obj.startY, label: 'Начало дуги (Точка 1)', type: 'endpoint' },
            { x: obj.endX, y: obj.endY, label: 'Конец дуги (Точка 2)', type: 'endpoint' },
            { x: obj.centerX, y: obj.centerY, label: `Центр дуги R${obj.radius}`, type: 'center' }
          );
        }

        for (const cand of candidates) {
          const candPx = worldToCanvas(cand.x, cand.y);
          const distPx = Math.hypot(candPx.x - mousePx.x, candPx.y - mousePx.y);

          if (distPx < minDistancePx) {
            minDistancePx = distPx;
            closestSnap = {
              ...cand,
              objectId: obj.id,
            };
          }
        }
      }

      if (closestSnap) {
        return {
          point: { x: closestSnap.x, y: closestSnap.y },
          snapInfo: closestSnap,
        };
      }

      // Fallback to grid snap if no object point within magnetic range
      return {
        point: applyGridSnap(rawWorldPt),
        snapInfo: null,
      };
    },
    [objectSnapEnabled, objects, worldToCanvas, applyGridSnap]
  );

  // Fit View
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth: w, clientHeight: h } = containerRef.current;

    const margin = 80;
    let xMin = machine.bounds.xMin;
    let xMax = machine.bounds.xMax;
    let yMin = machine.bounds.yMin;
    let yMax = machine.bounds.yMax;

    if (machine.stockSheet?.enabled && machine.stockSheet.preset !== 'none') {
      xMin = Math.min(xMin, -machine.stockSheet.widthX);
      yMin = Math.min(yMin, -machine.stockSheet.widthY);
    }

    const boundsW = Math.max(100, Math.abs(yMax - yMin));
    const boundsH = Math.max(100, Math.abs(xMax - xMin));

    const zoomX = (w - margin * 2) / boundsW;
    const zoomY = (h - margin * 2) / boundsH;
    const newZoom = Math.min(zoomX, zoomY, 2.5);

    setZoom(newZoom);
    setPan({
      x: w - margin - yMax * newZoom,
      y: h - margin - xMax * newZoom,
    });
  }, [machine.bounds, machine.stockSheet]);

  // Initial fit view
  useEffect(() => {
    handleFitView();
  }, [handleFitView]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    if (containerRef.current) {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#f8fafc'; // slate-50 light background
    ctx.fillRect(0, 0, width, height);

    // 1. DRAW GRID
    const bounds = machine.bounds;
    const cornerTL = canvasToWorld(0, 0);
    const cornerBR = canvasToWorld(width, height);

    const lowX = Math.floor(Math.min(cornerTL.x, cornerBR.x) / gridStep) * gridStep;
    const highX = Math.ceil(Math.max(cornerTL.x, cornerBR.x) / gridStep) * gridStep;
    const lowY = Math.floor(Math.min(cornerTL.y, cornerBR.y) / gridStep) * gridStep;
    const highY = Math.ceil(Math.max(cornerTL.y, cornerBR.y) / gridStep) * gridStep;

    ctx.lineWidth = 1;

    for (let x = lowX; x <= highX; x += gridStep) {
      const p1 = worldToCanvas(x, lowY);
      const p2 = worldToCanvas(x, highY);

      const isMajor = x % 50 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(203, 213, 225, 0.8)' : 'rgba(226, 232, 240, 0.7)';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      if (isMajor && zoom > 0.3) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        const labelP = worldToCanvas(x, 0);
        ctx.fillText(`${x}`, labelP.x + 4, labelP.y - 4);
      }
    }

    for (let y = lowY; y <= highY; y += gridStep) {
      const p1 = worldToCanvas(lowX, y);
      const p2 = worldToCanvas(highX, y);

      const isMajor = y % 50 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(203, 213, 225, 0.8)' : 'rgba(226, 232, 240, 0.7)';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      if (isMajor && zoom > 0.3) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        const labelP = worldToCanvas(0, y);
        ctx.fillText(`${y}`, labelP.x + 4, labelP.y + 12);
      }
    }

    // 2. DRAW MACHINE BOUNDS
    const mP1 = worldToCanvas(bounds.xMin, bounds.yMin);
    const mP2 = worldToCanvas(bounds.xMax, bounds.yMax);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      Math.min(mP1.x, mP2.x),
      Math.min(mP1.y, mP2.y),
      Math.abs(mP2.x - mP1.x),
      Math.abs(mP2.y - mP1.y)
    );
    ctx.setLineDash([]);

    // 2.5 DRAW STOCK SHEET BOUNDS (АБРИС ЛИСТА ЗАГОТОВКИ ПУНКТИРОМ)
    const stock = machine.stockSheet;
    if (stock && stock.enabled && stock.preset !== 'none' && stock.widthX > 0 && stock.widthY > 0) {
      const stockColor = stock.color || '#f59e0b';

      const sP1 = worldToCanvas(-stock.widthX, -stock.widthY);
      const sP2 = worldToCanvas(0, 0);

      const sX = Math.min(sP1.x, sP2.x);
      const sY = Math.min(sP1.y, sP2.y);
      const sW = Math.abs(sP2.x - sP1.x);
      const sH = Math.abs(sP2.y - sP1.y);

      // Light transparent fill background for stock material
      ctx.fillStyle = stockColor + '12'; // ~7% opacity hex suffix
      ctx.fillRect(sX, sY, sW, sH);

      // Dashed outline
      ctx.strokeStyle = stockColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(sX, sY, sW, sH);
      ctx.setLineDash([]);

      // Label at top corner of sheet
      ctx.fillStyle = stockColor;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        `Заготовка: ${stock.widthX}×${stock.widthY} мм`,
        sX + 8,
        sY + 16
      );
    }

    // 3. DRAW AXIS ORIGIN (0,0) AT BOTTOM-RIGHT
    const originC = worldToCanvas(0, 0);

    ctx.lineWidth = 2;
    // -X Axis (Points UP on screen)
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(originC.x, originC.y);
    ctx.lineTo(originC.x, originC.y - 60);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('-X (Вверх)', originC.x + 6, originC.y - 50);

    // -Y Axis (Points LEFT on screen)
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(originC.x, originC.y);
    ctx.lineTo(originC.x - 60, originC.y);
    ctx.stroke();

    ctx.fillStyle = '#22c55e';
    ctx.fillText('-Y (Влево)', originC.x - 55, originC.y + 15);

    // Work Zero marker
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(originC.x, originC.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 10px monospace';
    ctx.fillText('(0,0)', originC.x + 6, originC.y + 14);

    // 4. DRAW TOOLPATHS (IF PREVIEW OR GCODE VIEW MODE)
    if (viewMode === 'preview' || viewMode === 'gcode') {
      for (const seg of toolpathSegments) {
        const pStart = worldToCanvas(seg.startX, seg.startY);
        const pEnd = worldToCanvas(seg.endX, seg.endY);

        if (seg.type === 'rapid') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Red dashed
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(pStart.x, pStart.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (seg.type === 'feed') {
          ctx.strokeStyle = '#06b6d4'; // Cyan
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pStart.x, pStart.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();
        } else if (seg.type === 'arc_cw' || seg.type === 'arc_ccw') {
          ctx.strokeStyle = '#10b981'; // Green arc
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pStart.x, pStart.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();
        } else if (seg.type === 'drill') {
          ctx.fillStyle = '#a855f7'; // Purple dot
          ctx.beginPath();
          ctx.arc(pEnd.x, pEnd.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. DRAW CAD OBJECTS
    for (const obj of objects) {
      if (obj.visible === false) continue;
      const isSelected = obj.id === selectedObjectId;
      const isHoveredObj = hoveredHandle?.objectId === obj.id;

      ctx.lineWidth = isSelected ? 3 : isHoveredObj ? 2.5 : 2;
      ctx.strokeStyle = isSelected ? '#f59e0b' : isHoveredObj ? '#60a5fa' : '#38bdf8';

      if (obj.type === 'point') {
        const cp = worldToCanvas(obj.x, obj.y);
        const rPx = Math.max(4, (obj.diameter / 2) * zoom);

        ctx.beginPath();
        ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = isSelected ? '#f59e0b' : '#c084fc';
        ctx.beginPath();
        ctx.moveTo(cp.x - rPx - 4, cp.y);
        ctx.lineTo(cp.x + rPx + 4, cp.y);
        ctx.moveTo(cp.x, cp.y - rPx - 4);
        ctx.lineTo(cp.x, cp.y + rPx + 4);
        ctx.stroke();

        if (isSelected) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = '11px sans-serif';
          ctx.fillText(`${obj.name} (Ø${obj.diameter})`, cp.x + rPx + 6, cp.y - 4);
        }
      } else if (obj.type === 'line') {
        const p1 = worldToCanvas(obj.startX, obj.startY);
        const p2 = worldToCanvas(obj.endX, obj.endY);

        // Main line path
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Length annotation
        const lineLen = Math.hypot(obj.endX - obj.startX, obj.endY - obj.startY);
        const midPx = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        if (isSelected || isHoveredObj) {
          ctx.fillStyle = isSelected ? '#f59e0b' : '#93c5fd';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`${lineLen.toFixed(1)} мм`, midPx.x + 8, midPx.y - 8);
        }

        // --- INTERACTIVE ENDPOINT HANDLES ---
        const isStartHovered = isHoveredObj && hoveredHandle?.type === 'line_start';
        const isStartActive = dragMode === 'line_start' && selectedObjectId === obj.id;

        const isEndHovered = isHoveredObj && hoveredHandle?.type === 'line_end';
        const isEndActive = dragMode === 'line_end' && selectedObjectId === obj.id;

        // START HANDLE (POINT 1)
        const rStart = isStartActive ? 10 : isStartHovered ? 8 : isSelected ? 7 : 5;

        if (isStartHovered || isStartActive || isSelected) {
          ctx.fillStyle = isStartActive || isStartHovered ? 'rgba(34, 197, 94, 0.35)' : 'rgba(56, 189, 248, 0.2)';
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, rStart + 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isStartActive ? '#4ade80' : isStartHovered ? '#22c55e' : isSelected ? '#10b981' : '#38bdf8';
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
        const rEnd = isEndActive ? 10 : isEndHovered ? 8 : isSelected ? 7 : 5;

        if (isEndHovered || isEndActive || isSelected) {
          ctx.fillStyle = isEndActive || isEndHovered ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.2)';
          ctx.beginPath();
          ctx.arc(p2.x, p2.y, rEnd + 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isEndActive ? '#f87171' : isEndHovered ? '#ef4444' : isSelected ? '#f43f5e' : '#38bdf8';
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
      } else if (obj.type === 'polyline') {
        if (obj.points && obj.points.length >= 2) {
          const pts = obj.points.map((p) => worldToCanvas(p.x, p.y));
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          if (obj.closed) ctx.closePath();
          ctx.stroke();

          // Polyline vertex handles
          pts.forEach((pt, idx) => {
            const isPtHovered = isHoveredObj && hoveredHandle?.type === 'polyline_point' && hoveredHandle.pointIndex === idx;
            ctx.fillStyle = isPtHovered ? '#f59e0b' : isSelected ? '#38bdf8' : 'rgba(56,189,248,0.6)';
            ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
          });
        }
      } else if (obj.type === 'rectangle') {
        const p1 = worldToCanvas(obj.x, obj.y);
        const p2 = worldToCanvas(obj.x + obj.width, obj.y + obj.height);

        ctx.strokeRect(
          Math.min(p1.x, p2.x),
          Math.min(p1.y, p2.y),
          Math.abs(p2.x - p1.x),
          Math.abs(p2.y - p1.y)
        );

        if (isSelected) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
          ctx.fillRect(
            Math.min(p1.x, p2.x),
            Math.min(p1.y, p2.y),
            Math.abs(p2.x - p1.x),
            Math.abs(p2.y - p1.y)
          );
        }
      } else if (obj.type === 'circle') {
        const cp = worldToCanvas(obj.centerX, obj.centerY);
        const rPx = obj.radius * zoom;

        ctx.beginPath();
        ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
        ctx.stroke();

        if (isSelected) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, rPx, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (obj.type === 'arc') {
        const cp = worldToCanvas(obj.centerX, obj.centerY);
        const rPx = obj.radius * zoom;
        const pStart = worldToCanvas(obj.startX, obj.startY);
        const pEnd = worldToCanvas(obj.endX, obj.endY);

        const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
        const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);

        ctx.beginPath();
        ctx.arc(cp.x, cp.y, rPx, a1, a2, !obj.clockwise);
        ctx.stroke();

        // Direction arrow / indicator on arc
        if (isSelected || isHoveredObj) {
          // Draw start handle (Green)
          const isStartHovered = isHoveredObj && hoveredHandle?.type === 'arc_start';
          ctx.fillStyle = isStartHovered ? '#f59e0b' : '#22c55e';
          ctx.beginPath();
          ctx.arc(pStart.x, pStart.y, 5, 0, Math.PI * 2);
          ctx.fill();

          // Draw end handle (Red)
          const isEndHovered = isHoveredObj && hoveredHandle?.type === 'arc_end';
          ctx.fillStyle = isEndHovered ? '#f59e0b' : '#ef4444';
          ctx.beginPath();
          ctx.arc(pEnd.x, pEnd.y, 5, 0, Math.PI * 2);
          ctx.fill();

          // Draw center handle (Cyan)
          const isCenterHovered = isHoveredObj && hoveredHandle?.type === 'arc_center';
          ctx.fillStyle = isCenterHovered ? '#f59e0b' : '#06b6d4';
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Center cross mark
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cp.x - 6, cp.y);
          ctx.lineTo(cp.x + 6, cp.y);
          ctx.moveTo(cp.x, cp.y - 6);
          ctx.lineTo(cp.x, cp.y + 6);
          ctx.stroke();
        }
      }
    }

    // 6. DRAW INTERACTIVE DRAWING PREVIEW
    if (activeTool !== 'select' && currentMouseProgPt) {
      ctx.strokeStyle = '#f43f5e'; // Rose active line
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      if (activeTool === 'arc') {
        if (drawArcStartPt && !drawArcEndPt) {
          const p1 = worldToCanvas(drawArcStartPt.x, drawArcStartPt.y);
          const p2 = worldToCanvas(currentMouseProgPt.x, currentMouseProgPt.y);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        } else if (drawArcStartPt && drawArcEndPt) {
          const arcData = getArcFrom3Points(drawArcStartPt, drawArcEndPt, currentMouseProgPt);
          const cp = worldToCanvas(arcData.centerX, arcData.centerY);
          const rPx = arcData.radius * zoom;
          const pStart = worldToCanvas(drawArcStartPt.x, drawArcStartPt.y);
          const pEnd = worldToCanvas(drawArcEndPt.x, drawArcEndPt.y);

          const a1 = Math.atan2(pStart.y - cp.y, pStart.x - cp.x);
          const a2 = Math.atan2(pEnd.y - cp.y, pEnd.x - cp.x);

          ctx.beginPath();
          ctx.arc(cp.x, cp.y, rPx, a1, a2, !arcData.clockwise);
          ctx.stroke();

          // Center marker
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (drawStartPt) {
        const p1 = worldToCanvas(drawStartPt.x, drawStartPt.y);
        const p2 = worldToCanvas(currentMouseProgPt.x, currentMouseProgPt.y);

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

    // 7. DRAW MAGNETIC SNAP INDICATOR TARGET
    if (activeSnapInfo) {
      const sp = worldToCanvas(activeSnapInfo.x, activeSnapInfo.y);

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
        // Target icon for hole centers
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(sp.x - 14, sp.y);
        ctx.lineTo(sp.x + 14, sp.y);
        ctx.moveTo(sp.x, sp.y - 14);
        ctx.lineTo(sp.x, sp.y + 14);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Diamond / Square for endpoints & corners
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

      // Rounded rectangle badge
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
  }, [
    pan,
    zoom,
    gridStep,
    machine,
    objects,
    selectedObjectId,
    toolpathSegments,
    viewMode,
    activeTool,
    drawStartPt,
    currentMouseProgPt,
    dragMode,
    hoveredHandle,
    activeSnapInfo,
    worldToCanvas,
    canvasToWorld,
  ]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2 || (e.shiftKey && activeTool !== 'select')) {
      // Pan mode
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y);
    const { point: snappedPt } = findMagneticSnapPoint(rawWorldPt, mousePx, selectedObjectId || undefined);

    if (activeTool === 'point') {
      const newHole: CADObject = {
        id: `obj_${Date.now()}`,
        name: `Отверстие 11мм (${snappedPt.x}, ${snappedPt.y})`,
        type: 'point',
        x: snappedPt.x,
        y: snappedPt.y,
        diameter: 11.0,
        depth: 33,
        drillMode: '11mm',
        operationType: 'drill',
      };
      addObject(newHole);
      setActiveTool('select');
    } else if (activeTool === 'arc') {
      if (!drawArcStartPt) {
        setDrawArcStartPt(snappedPt);
      } else if (!drawArcEndPt) {
        setDrawArcEndPt(snappedPt);
      } else {
        const arcData = getArcFrom3Points(drawArcStartPt, drawArcEndPt, snappedPt);
        addObject({
          id: `obj_${Date.now()}`,
          name: `Дуга R${Math.round(arcData.radius)}`,
          type: 'arc',
          startX: drawArcStartPt.x,
          startY: drawArcStartPt.y,
          endX: drawArcEndPt.x,
          endY: drawArcEndPt.y,
          centerX: arcData.centerX,
          centerY: arcData.centerY,
          radius: arcData.radius,
          clockwise: arcData.clockwise,
          depth: 5,
          operationType: 'cut',
        });
        setDrawArcStartPt(null);
        setDrawArcEndPt(null);
        setActiveTool('select');
      }
    } else if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') {
      if (!drawStartPt) {
        setDrawStartPt(snappedPt);
      } else {
        if (activeTool === 'line') {
          addObject({
            id: `obj_${Date.now()}`,
            name: `Отрезок`,
            type: 'line',
            startX: drawStartPt.x,
            startY: drawStartPt.y,
            endX: snappedPt.x,
            endY: snappedPt.y,
            depth: 5,
            operationType: 'cut',
          });
        } else if (activeTool === 'rectangle') {
          const w = Math.abs(snappedPt.x - drawStartPt.x);
          const h = Math.abs(snappedPt.y - drawStartPt.y);
          const minX = Math.min(drawStartPt.x, snappedPt.x);
          const minY = Math.min(drawStartPt.y, snappedPt.y);
          addObject({
            id: `obj_${Date.now()}`,
            name: `Прямоугольник ${Math.round(w)}x${Math.round(h)}`,
            type: 'rectangle',
            x: minX,
            y: minY,
            width: w || 50,
            height: h || 50,
            depth: 5,
            operationType: 'cut',
          });
        } else if (activeTool === 'circle') {
          const dx = snappedPt.x - drawStartPt.x;
          const dy = snappedPt.y - drawStartPt.y;
          const r = Math.round(Math.sqrt(dx * dx + dy * dy)) || 20;
          addObject({
            id: `obj_${Date.now()}`,
            name: `Окружность R${r}`,
            type: 'circle',
            centerX: drawStartPt.x,
            centerY: drawStartPt.y,
            radius: r,
            depth: 5,
            operationType: 'mill_circle',
          });
        }
        setDrawStartPt(null);
        setActiveTool('select');
      }
    } else if (activeTool === 'select') {
      const handleHitRadiusPx = 14;

      // 1. FIRST CHECK ENDPOINT HANDLES OF SELECTED OBJECT (high priority)
      let hitHandle: { objectId: string; type: DragMode; index?: number } | null = null;

      if (selectedObjectId) {
        const selObj = objects.find((o) => o.id === selectedObjectId);
        if (selObj && selObj.visible !== false) {
          if (selObj.type === 'line') {
            const p1 = worldToCanvas(selObj.startX, selObj.startY);
            const p2 = worldToCanvas(selObj.endX, selObj.endY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: selObj.id, type: 'line_start' };
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: selObj.id, type: 'line_end' };
            }
          } else if (selObj.type === 'arc') {
            const p1 = worldToCanvas(selObj.startX, selObj.startY);
            const p2 = worldToCanvas(selObj.endX, selObj.endY);
            const cp = worldToCanvas(selObj.centerX, selObj.centerY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: selObj.id, type: 'arc_start' };
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: selObj.id, type: 'arc_end' };
            } else if (Math.hypot(mousePx.x - cp.x, mousePx.y - cp.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: selObj.id, type: 'arc_center' };
            }
          }
        }
      }

      // 2. CHECK ALL OBJECT HANDLES IF NOT HIT SELECTED OBJECT HANDLE
      if (!hitHandle) {
        for (const obj of objects) {
          if (obj.visible === false) continue;
          if (obj.type === 'line') {
            const p1 = worldToCanvas(obj.startX, obj.startY);
            const p2 = worldToCanvas(obj.endX, obj.endY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: obj.id, type: 'line_start' };
              break;
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: obj.id, type: 'line_end' };
              break;
            }
          } else if (obj.type === 'arc') {
            const p1 = worldToCanvas(obj.startX, obj.startY);
            const p2 = worldToCanvas(obj.endX, obj.endY);
            const cp = worldToCanvas(obj.centerX, obj.centerY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: obj.id, type: 'arc_start' };
              break;
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: obj.id, type: 'arc_end' };
              break;
            } else if (Math.hypot(mousePx.x - cp.x, mousePx.y - cp.y) <= handleHitRadiusPx) {
              hitHandle = { objectId: obj.id, type: 'arc_center' };
              break;
            }
          }
        }
      }

      // IF HANDLE HIT: START ENDPOINT DRAGGING
      if (hitHandle) {
        setSelectedObjectId(hitHandle.objectId);
        setDragMode(hitHandle.type);
        setDragStartMousePt(snappedPt);
        const targetObj = objects.find((o) => o.id === hitHandle!.objectId);
        setDragStartObjPos(targetObj ? JSON.parse(JSON.stringify(targetObj)) : null);
        recordHistory();
        return;
      }

      // 3. IF NOT HANDLE, CHECK BODY SELECTION
      let hitId: string | null = null;
      const hitTolerance = 12 / zoom;

      for (const obj of objects) {
        if (obj.visible === false) continue;
        if (obj.type === 'point') {
          const dist = Math.hypot(rawWorldPt.x - obj.x, rawWorldPt.y - obj.y);
          if (dist <= Math.max(obj.diameter / 2, hitTolerance)) {
            hitId = obj.id;
            break;
          }
        } else if (obj.type === 'rectangle') {
          if (
            rawWorldPt.x >= obj.x - hitTolerance &&
            rawWorldPt.x <= obj.x + obj.width + hitTolerance &&
            rawWorldPt.y >= obj.y - hitTolerance &&
            rawWorldPt.y <= obj.y + obj.height + hitTolerance
          ) {
            hitId = obj.id;
            break;
          }
        } else if (obj.type === 'circle') {
          const dist = Math.hypot(rawWorldPt.x - obj.centerX, rawWorldPt.y - obj.centerY);
          if (Math.abs(dist - obj.radius) <= hitTolerance || dist <= obj.radius) {
            hitId = obj.id;
            break;
          }
        } else if (obj.type === 'line') {
          const d1 = Math.hypot(rawWorldPt.x - obj.startX, rawWorldPt.y - obj.startY);
          const d2 = Math.hypot(rawWorldPt.x - obj.endX, rawWorldPt.y - obj.endY);
          const lineLen = Math.hypot(obj.endX - obj.startX, obj.endY - obj.startY);
          if (d1 + d2 >= lineLen - hitTolerance && d1 + d2 <= lineLen + hitTolerance) {
            hitId = obj.id;
            break;
          }
        } else if (obj.type === 'arc') {
          const dist = Math.hypot(rawWorldPt.x - obj.centerX, rawWorldPt.y - obj.centerY);
          if (Math.abs(dist - obj.radius) <= hitTolerance) {
            hitId = obj.id;
            break;
          }
        }
      }

      setSelectedObjectId(hitId);

      if (hitId) {
        setDragMode('object');
        setDragStartMousePt(snappedPt);
        const targetObj = objects.find((o) => o.id === hitId);
        setDragStartObjPos(targetObj ? JSON.parse(JSON.stringify(targetObj)) : null);
        recordHistory();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y);

    const { point: snappedPt, snapInfo } = findMagneticSnapPoint(
      rawWorldPt,
      mousePx,
      selectedObjectId || undefined,
      dragMode
    );

    setActiveSnapInfo(snapInfo);
    setCurrentMouseProgPt(snappedPt);
    onCursorMove(snappedPt);

    // 1. HOVER HANDLE DETECTION
    if (dragMode === 'none' && activeTool === 'select') {
      const handleHitRadiusPx = 14;
      let foundHover: HoveredHandle | null = null;

      // Prioritize selected object
      if (selectedObjectId) {
        const selObj = objects.find((o) => o.id === selectedObjectId);
        if (selObj && selObj.visible !== false) {
          if (selObj.type === 'line') {
            const p1 = worldToCanvas(selObj.startX, selObj.startY);
            const p2 = worldToCanvas(selObj.endX, selObj.endY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              foundHover = { objectId: selObj.id, type: 'line_start' };
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              foundHover = { objectId: selObj.id, type: 'line_end' };
            }
          } else if (selObj.type === 'arc') {
            const p1 = worldToCanvas(selObj.startX, selObj.startY);
            const p2 = worldToCanvas(selObj.endX, selObj.endY);
            const cp = worldToCanvas(selObj.centerX, selObj.centerY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              foundHover = { objectId: selObj.id, type: 'arc_start' };
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              foundHover = { objectId: selObj.id, type: 'arc_end' };
            } else if (Math.hypot(mousePx.x - cp.x, mousePx.y - cp.y) <= handleHitRadiusPx) {
              foundHover = { objectId: selObj.id, type: 'arc_center' };
            }
          }
        }
      }

      if (!foundHover) {
        for (const obj of objects) {
          if (obj.visible === false) continue;
          if (obj.type === 'line') {
            const p1 = worldToCanvas(obj.startX, obj.startY);
            const p2 = worldToCanvas(obj.endX, obj.endY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              foundHover = { objectId: obj.id, type: 'line_start' };
              break;
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              foundHover = { objectId: obj.id, type: 'line_end' };
              break;
            }
          } else if (obj.type === 'arc') {
            const p1 = worldToCanvas(obj.startX, obj.startY);
            const p2 = worldToCanvas(obj.endX, obj.endY);
            const cp = worldToCanvas(obj.centerX, obj.centerY);

            if (Math.hypot(mousePx.x - p1.x, mousePx.y - p1.y) <= handleHitRadiusPx) {
              foundHover = { objectId: obj.id, type: 'arc_start' };
              break;
            } else if (Math.hypot(mousePx.x - p2.x, mousePx.y - p2.y) <= handleHitRadiusPx) {
              foundHover = { objectId: obj.id, type: 'arc_end' };
              break;
            } else if (Math.hypot(mousePx.x - cp.x, mousePx.y - cp.y) <= handleHitRadiusPx) {
              foundHover = { objectId: obj.id, type: 'arc_center' };
              break;
            }
          }
        }
      }

      setHoveredHandle(foundHover);

      if (canvasRef.current) {
        if (foundHover) {
          canvasRef.current.style.cursor = 'grab';
        } else {
          canvasRef.current.style.cursor = 'crosshair';
        }
      }
    }

    // 2. ACTIVE DRAGGING
    if (dragMode !== 'none' && selectedObjectId) {
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }

      if (dragMode === 'line_start') {
        const obj = objects.find((o) => o.id === selectedObjectId) as LineObject;
        if (obj && obj.type === 'line') {
          let targetPt = snappedPt;

          // Angle lock with Shift key (0°, 45°, 90°, 135°, 180°, etc. relative to end point)
          if ((e.shiftKey || isShiftPressed) && !snapInfo) {
            const dx = snappedPt.x - obj.endX;
            const dy = snappedPt.y - obj.endY;
            const len = Math.hypot(dx, dy);
            const ang = Math.atan2(dy, dx);
            const snappedAng = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);

            targetPt = applyGridSnap({
              x: obj.endX + len * Math.cos(snappedAng),
              y: obj.endY + len * Math.sin(snappedAng),
            });
          }

          updateObject(selectedObjectId, { startX: targetPt.x, startY: targetPt.y }, false);
        }
      } else if (dragMode === 'line_end') {
        const obj = objects.find((o) => o.id === selectedObjectId) as LineObject;
        if (obj && obj.type === 'line') {
          let targetPt = snappedPt;

          // Angle lock with Shift key relative to start point
          if ((e.shiftKey || isShiftPressed) && !snapInfo) {
            const dx = snappedPt.x - obj.startX;
            const dy = snappedPt.y - obj.startY;
            const len = Math.hypot(dx, dy);
            const ang = Math.atan2(dy, dx);
            const snappedAng = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);

            targetPt = applyGridSnap({
              x: obj.startX + len * Math.cos(snappedAng),
              y: obj.startY + len * Math.sin(snappedAng),
            });
          }

          updateObject(selectedObjectId, { endX: targetPt.x, endY: targetPt.y }, false);
        }
      } else if (dragMode === 'arc_start') {
        const obj = objects.find((o) => o.id === selectedObjectId);
        if (obj && obj.type === 'arc') {
          const newRadius = Math.hypot(snappedPt.x - obj.centerX, snappedPt.y - obj.centerY) || 1;
          updateObject(selectedObjectId, { startX: snappedPt.x, startY: snappedPt.y, radius: newRadius }, false);
        }
      } else if (dragMode === 'arc_end') {
        const obj = objects.find((o) => o.id === selectedObjectId);
        if (obj && obj.type === 'arc') {
          updateObject(selectedObjectId, { endX: snappedPt.x, endY: snappedPt.y }, false);
        }
      } else if (dragMode === 'arc_center') {
        const obj = objects.find((o) => o.id === selectedObjectId);
        if (obj && obj.type === 'arc') {
          updateObject(selectedObjectId, { centerX: snappedPt.x, centerY: snappedPt.y }, false);
        }
      } else if (dragMode === 'object' && dragStartMousePt && dragStartObjPos) {
        const dx = snappedPt.x - dragStartMousePt.x;
        const dy = snappedPt.y - dragStartMousePt.y;

        const obj = dragStartObjPos;
        if (obj.type === 'point') {
          updateObject(selectedObjectId, { x: obj.x + dx, y: obj.y + dy }, false);
        } else if (obj.type === 'line') {
          updateObject(
            selectedObjectId,
            {
              startX: obj.startX + dx,
              startY: obj.startY + dy,
              endX: obj.endX + dx,
              endY: obj.endY + dy,
            },
            false
          );
        } else if (obj.type === 'rectangle') {
          updateObject(selectedObjectId, { x: obj.x + dx, y: obj.y + dy }, false);
        } else if (obj.type === 'circle') {
          updateObject(selectedObjectId, { centerX: obj.centerX + dx, centerY: obj.centerY + dy }, false);
        } else if (obj.type === 'arc') {
          updateObject(
            selectedObjectId,
            {
              startX: obj.startX + dx,
              startY: obj.startY + dy,
              endX: obj.endX + dx,
              endY: obj.endY + dy,
              centerX: obj.centerX + dx,
              centerY: obj.centerY + dy,
            },
            false
          );
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDragMode('none');
    setDragStartMousePt(null);
    setDragStartObjPos(null);
    setActiveSnapInfo(null);

    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredHandle ? 'grab' : 'crosshair';
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(0.1, zoom * zoomFactor), 15);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    setPan({
      x: mousePx.x - (mousePx.x - pan.x) * (newZoom / zoom),
      y: mousePx.y - (mousePx.y - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  // Helper info for current dragged line
  const selectedLineObj =
    selectedObjectId && (dragMode === 'line_start' || dragMode === 'line_end')
      ? (objects.find((o) => o.id === selectedObjectId && o.type === 'line') as LineObject)
      : null;

  const currentLineStats = selectedLineObj
    ? (() => {
        const dx = selectedLineObj.endX - selectedLineObj.startX;
        const dy = selectedLineObj.endY - selectedLineObj.startY;
        const len = Math.hypot(dx, dy);
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (ang < 0) ang += 360;
        return { len, ang, dx, dy };
      })()
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-900 overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block"
      />

      {/* Floating Canvas Controls (Zoom / Snap / Fit View) */}
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm p-1.5 rounded-lg border border-slate-700 shadow-lg text-slate-200">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.25, 15))}
          title="Приблизить (+)"
          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.8, 0.1))}
          title="Отдалить (-)"
          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-700" />

        <button
          onClick={handleFitView}
          title="Вписать в экран"
          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
        >
          <Maximize className="w-4 h-4 text-blue-400" />
        </button>

        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          title={snapToGrid ? 'Привязка к сетке ВКЛ' : 'Привязка к сетке ВЫКЛ'}
          className={`px-2 py-1 text-xs font-semibold rounded flex items-center gap-1 transition-colors ${
            snapToGrid ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50' : 'hover:bg-slate-700 text-slate-400'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>{gridStep}мм</span>
        </button>

        <button
          onClick={() => setObjectSnapEnabled(!objectSnapEnabled)}
          title={objectSnapEnabled ? 'Магнитная привязка к объектам ВКЛ' : 'Магнитная привязка ВЫКЛ'}
          className={`px-2 py-1 text-xs font-semibold rounded flex items-center gap-1 transition-colors ${
            objectSnapEnabled ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'hover:bg-slate-700 text-slate-400'
          }`}
        >
          <Magnet className="w-3.5 h-3.5" />
          <span>Магнит</span>
        </button>
      </div>

      {/* REAL-TIME LINE ENDPOINT DRAG HUD TOOLTIP */}
      {selectedLineObj && currentLineStats && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-amber-500/50 rounded-xl p-3 shadow-2xl backdrop-blur-md text-slate-100 text-xs space-y-1.5 min-w-[280px]">
          <div className="flex items-center justify-between font-bold text-amber-400 border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              {dragMode === 'line_start' ? 'Редактирование НАЧАЛА линии (Точка 1)' : 'Редактирование КОНЦА линии (Точка 2)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-0.5">
            <div>
              <span className="text-slate-400 block text-[10px]">Координата X1:</span>
              <span className="text-emerald-400 font-bold">{selectedLineObj.startX.toFixed(1)} мм</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Координата Y1:</span>
              <span className="text-emerald-400 font-bold">{selectedLineObj.startY.toFixed(1)} мм</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Координата X2:</span>
              <span className="text-rose-400 font-bold">{selectedLineObj.endX.toFixed(1)} мм</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Координата Y2:</span>
              <span className="text-rose-400 font-bold">{selectedLineObj.endY.toFixed(1)} мм</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] font-mono text-slate-300">
            <span>
              Длина: <strong className="text-amber-300">{currentLineStats.len.toFixed(1)} мм</strong>
            </span>
            <span>
              Угол: <strong className="text-cyan-300">{currentLineStats.ang.toFixed(1)}°</strong>
            </span>
          </div>

          <div className="text-[10px] text-slate-400 pt-0.5 flex items-center justify-between">
            <span>Удерживайте <kbd className="bg-slate-800 border border-slate-700 rounded px-1 text-slate-200">Shift</kbd> для ортогонального шага 45°</span>
          </div>
        </div>
      )}

      {/* Active Tool Helper Banner */}
      {activeTool !== 'select' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg font-medium flex items-center gap-2 animate-pulse z-20">
          <span>
            {activeTool === 'point' && 'Кликните на холсте, чтобы поставить отверстие'}
            {activeTool === 'line' && (drawStartPt ? 'Кликните вторую точку отрезка' : 'Кликните первую точку отрезка')}
            {activeTool === 'rectangle' && (drawStartPt ? 'Кликните второй угол прямоугольника' : 'Кликните первый угол прямоугольника')}
            {activeTool === 'circle' && (drawStartPt ? 'Укажите радиус окружности' : 'Кликните центр окружности')}
            {activeTool === 'arc' &&
              (!drawArcStartPt
                ? 'Кликните начальную точку дуги (1/3)'
                : !drawArcEndPt
                ? 'Кликните конечную точку дуги (2/3)'
                : 'Укажите изгиб / радиус дуги на холсте (3/3)')}
          </span>
          <button
            onClick={() => {
              setDrawStartPt(null);
              setDrawArcStartPt(null);
              setDrawArcEndPt(null);
              setActiveTool('select');
            }}
            className="ml-2 bg-blue-800 hover:bg-blue-900 px-2 py-0.5 rounded text-[11px]"
          >
            Отмена (Esc)
          </button>
        </div>
      )}
    </div>
  );
};


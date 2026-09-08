import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { CADObject, Point2D } from '../../types';
import { CanvasControls } from './CanvasControls';
import { CanvasHud } from './CanvasHud';
import {
  DragMode,
  findHandleHit,
  findMagneticSnapPoint,
  findObjectBodyHit,
  findObjectsInBox,
} from './canvasHitTest';
import {
  drawAxisOrigin,
  drawCADObjects,
  drawDrawingPreview,
  drawGrid,
  drawMachineBoundsAndStock,
  drawMeasurementTool,
  drawSelectionBox,
  drawSnapIndicator,
  drawToolpathSegments,
  drawUnderlay,
  getUnderlayCanvasRect,
  UNDERLAY_HANDLE_PX,
} from './canvasDrawers';
import {
  HoveredHandle,
  SnapPointInfo,
  canvasToWorld,
  getArcFrom3Points,
} from './canvasUtils';
import { paletteForTheme } from './canvasPalette';
import { constrainAngle } from '../../lib/geometry/transform';
import { useIsMobile } from '../../hooks/useIsMobile';

/** Point at distance `len` from `origin` along angle `ang` (radians). */
function pointFromPolar(origin: Point2D, ang: number, len: number): Point2D {
  return { x: origin.x + len * Math.cos(ang), y: origin.y + len * Math.sin(ang) };
}

/** Не выпускать точку за грани +X (x=0) и +Y (y=0) заготовки (лист лежит в x<=0, y<=0). */
function clampToPosFaces(pt: Point2D): Point2D {
  return { x: Math.min(pt.x, 0), y: Math.min(pt.y, 0) };
}

/**
 * Если конец отрезка/хорды ушёл за грани +X/+Y, укоротить луч anchor→end до
 * пересечения с ближайшей гранью — отрезок «упирается» в неё.
 */
function clampRayToPosFaces(anchor: Point2D, end: Point2D): Point2D {
  const dx = end.x - anchor.x;
  const dy = end.y - anchor.y;
  let t = 1;
  if (end.x > 0 && dx > 1e-9) t = Math.min(t, Math.max(0, -anchor.x / dx));
  if (end.y > 0 && dy > 1e-9) t = Math.min(t, Math.max(0, -anchor.y / dy));
  if (t >= 1) return end;
  return { x: anchor.x + dx * t, y: anchor.y + dy * t };
}

interface SceneCanvasProps {
  onCursorMove?: (pt: Point2D | null) => void;
}

/**
 * Единый «курсор» для мыши и касаний: все обработчики холста работают с этим
 * типизированным минимумом, поэтому тач и мышь проходят один и тот же код.
 */
interface CanvasPointer {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  button?: number;
}

function shiftCADObject(obj: CADObject, dx: number, dy: number): Partial<CADObject> {
  if (obj.type === 'point') {
    return { x: obj.x + dx, y: obj.y + dy };
  }
  if (obj.type === 'line') {
    return {
      startX: obj.startX + dx,
      startY: obj.startY + dy,
      endX: obj.endX + dx,
      endY: obj.endY + dy,
    };
  }
  if (obj.type === 'rectangle') {
    return { x: obj.x + dx, y: obj.y + dy };
  }
  if (obj.type === 'circle') {
    return { centerX: obj.centerX + dx, centerY: obj.centerY + dy };
  }
  if (obj.type === 'arc') {
    return {
      startX: obj.startX + dx,
      startY: obj.startY + dy,
      endX: obj.endX + dx,
      endY: obj.endY + dy,
      centerX: obj.centerX + dx,
      centerY: obj.centerY + dy,
    };
  }
  if (obj.type === 'polyline' && obj.points) {
    return {
      points: obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
  return {};
}

function translateObjectFull(obj: CADObject, dx: number, dy: number): CADObject {
  return { ...obj, ...shiftCADObject(obj, dx, dy) } as CADObject;
}

// Live, uncommitted drag state. During a drag we only touch this local state and
// redraw from it; the store is mutated exactly once on mouseup (see handleMouseUp).
type LiveDrag =
  | { mode: 'none' }
  | { mode: 'translate'; dx: number; dy: number; ids: string[] }
  | { mode: 'edit'; id: string; patch: Partial<CADObject> };

export const SceneCanvas: React.FC<SceneCanvasProps> = ({ onCursorMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    objects,
    selectedObjectId,
    selectedObjectIds,
    setSelectedObjectId,
    setSelectedObjectIds,
    toggleObjectSelection,
    addObject,
    updateObject,
    updateObjectsBulk,
    deleteSelectedObjects,
    machine,
    toolpathSegments,
    viewMode,
    setViewMode,
    activeTool,
    setActiveTool,
    snapToGrid,
    setSnapToGrid,
    gridStep,
    setLiveEdit,
    setLiveMeasure,
    underlay,
    updateUnderlay,
    mobileSheet,
    theme,
  } = useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      selectedObjectId: s.selectedObjectId,
      selectedObjectIds: s.selectedObjectIds,
      setSelectedObjectId: s.setSelectedObjectId,
      setSelectedObjectIds: s.setSelectedObjectIds,
      toggleObjectSelection: s.toggleObjectSelection,
      addObject: s.addObject,
      updateObject: s.updateObject,
      updateObjectsBulk: s.updateObjectsBulk,
      deleteSelectedObjects: s.deleteSelectedObjects,
      machine: s.machine,
      toolpathSegments: s.toolpathSegments,
      viewMode: s.viewMode,
      setViewMode: s.setViewMode,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      snapToGrid: s.snapToGrid,
      setSnapToGrid: s.setSnapToGrid,
      gridStep: s.gridStep,
      setLiveEdit: s.setLiveEdit,
      setLiveMeasure: s.setLiveMeasure,
      underlay: s.underlay,
      updateUnderlay: s.updateUnderlay,
      mobileSheet: s.mobileSheet,
      theme: s.theme,
    }))
  );

  // Canvas Pan & Zoom
  const [pan, setPan] = useState<Point2D>({ x: 350, y: 350 });
  const [zoom, setZoom] = useState<number>(1.2);

  // Палитра холста следует за темой приложения (светлая/тёмная).
  const palette = useMemo(() => paletteForTheme(theme), [theme]);

  // Перерисовка/ресайз канваса при изменении размера окна (телефон: адресная строка, поворот)
  const [viewportVer, setViewportVer] = useState(0);
  useEffect(() => {
    const onResize = () => setViewportVer((v) => v + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Magnetic Snapping
  const [objectSnapEnabled, setObjectSnapEnabled] = useState<boolean>(true);
  const [activeSnapInfo, setActiveSnapInfo] = useState<SnapPointInfo | null>(null);

  // Dragging & Hover state
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStartCanvasPt, setDragStartCanvasPt] = useState<Point2D>({ x: 0, y: 0 });
  const [dragStartWorldPt, setDragStartWorldPt] = useState<Point2D>({ x: 0, y: 0 });
  const [dragObjInitial, setDragObjInitial] = useState<CADObject | null>(null);
  const [dragIds, setDragIds] = useState<string[]>([]);
  const [liveDrag, setLiveDrag] = useState<LiveDrag>({ mode: 'none' });
  const [hoveredHandle, setHoveredHandle] = useState<HoveredHandle | null>(null);

  // Selection Box Marquee
  const [selectionBoxStart, setSelectionBoxStart] = useState<Point2D | null>(null);
  const [selectionBoxCurrent, setSelectionBoxCurrent] = useState<Point2D | null>(null);

  // Active Drawing Tool state
  const [drawStartPt, setDrawStartPt] = useState<Point2D | null>(null);
  const [drawArcStartPt, setDrawArcStartPt] = useState<Point2D | null>(null);
  const [drawArcEndPt, setDrawArcEndPt] = useState<Point2D | null>(null);
  const [currentMouseProgPt, setCurrentMouseProgPt] = useState<Point2D | null>(null);

  // Active Measurement Tool state
  const [measureStartPt, setMeasureStartPt] = useState<Point2D | null>(null);
  const [measureEndPt, setMeasureEndPt] = useState<Point2D | null>(null);

  // Подложка (фоновая референсная картинка, только на сессию): кэш загруженного
  // изображения + версия для ре-рендера после загрузки + временное состояние драга.
  const underlayImgRef = useRef<HTMLImageElement | null>(null);
  const [underlayImgVer, setUnderlayImgVer] = useState(0);
  const underlayDragRef = useRef<
    | { mode: 'move'; startWorld: Point2D; origX: number; origY: number }
    | {
        mode: 'resize';
        startWorld: Point2D;
        origX: number;
        origY: number;
        origW: number;
        origH: number;
      }
    | null
  >(null);

  useEffect(() => {
    if (!underlay.src) {
      underlayImgRef.current = null;
      setUnderlayImgVer((v) => v + 1);
      return;
    }
    const img = new Image();
    img.onload = () => {
      underlayImgRef.current = img;
      setUnderlayImgVer((v) => v + 1);
    };
    img.onerror = () => {
      underlayImgRef.current = null;
      setUnderlayImgVer((v) => v + 1);
    };
    img.src = underlay.src;
  }, [underlay.src]);

  // Dynamic distance input (DYN) shared by the line tool and the arc's start→end
  // chord: type a distance, press Enter to place the point at that length.
  const [lineLengthInput, setLineLengthInput] = useState<string>('');
  const [lineDirAngle, setLineDirAngle] = useState<number>(0);

  // Latest drawing state/functions for the window keydown handler (avoids stale closures)
  const drawStateRef = useRef({
    activeTool,
    drawStartPt,
    drawArcStartPt,
    drawArcEndPt,
    lineLengthInput,
    lineDirAngle,
  });
  drawStateRef.current = {
    activeTool,
    drawStartPt,
    drawArcStartPt,
    drawArcEndPt,
    lineLengthInput,
    lineDirAngle,
  };
  const finishLineRef = useRef<(end: Point2D) => void>(() => {});
  finishLineRef.current = (end: Point2D) => {
    if (!drawStartPt) return;
    const clamped = clampRayToPosFaces(drawStartPt, end);
    if (Math.hypot(clamped.x - drawStartPt.x, clamped.y - drawStartPt.y) < 0.1) {
      // Уперся в грань ровно в свою же точку — не создаём вырожденный отрезок.
      setDrawStartPt(null);
      setLineLengthInput('');
      return;
    }
    addObject({
      name: `Отрезок ${objects.length + 1}`,
      type: 'line',
      startX: drawStartPt.x,
      startY: drawStartPt.y,
      endX: clamped.x,
      endY: clamped.y,
      depth: 5,
      operationType: 'cut',
    });
    setDrawStartPt(null);
    setLineLengthInput('');
  };

  // DYN: place the pending line end / arc chord end at the typed length along the
  // current rubber-band direction. Used by Enter (desktop) and the on-screen OK (mobile).
  const commitDynLength = () => {
    const ds = drawStateRef.current;
    const anchor =
      ds.activeTool === 'line'
        ? ds.drawStartPt
        : ds.activeTool === 'arc' && !ds.drawArcEndPt
        ? ds.drawArcStartPt
        : null;
    if (!anchor) return;
    const L = parseFloat(ds.lineLengthInput);
    if (!(L > 0)) return;
    const end = pointFromPolar(anchor, ds.lineDirAngle, L);
    if (ds.activeTool === 'arc') {
      setDrawArcEndPt(clampRayToPosFaces(anchor, end));
      setLineLengthInput('');
    } else {
      finishLineRef.current(end);
    }
  };

  useEffect(() => {
    if (activeTool !== 'measure') {
      setMeasureStartPt(null);
      setMeasureEndPt(null);
    }
  }, [activeTool]);

  // Mirror the transient vertex-edit drag into the store so the Свойства panel shows the
  // live coordinates while a handle is dragged (store objects stay untouched until mouseup).
  useEffect(() => {
    setLiveEdit(liveDrag.mode === 'edit' ? { id: liveDrag.id, patch: liveDrag.patch } : null);
  }, [liveDrag, setLiveEdit]);

  // Mirror the ruler into the store so the Свойства panel shows a live readout instead of
  // a floating window.
  useEffect(() => {
    if (activeTool === 'measure' && measureStartPt) {
      const end = measureEndPt ?? currentMouseProgPt;
      setLiveMeasure(end ? { start: measureStartPt, end } : null);
    } else {
      setLiveMeasure(null);
    }
  }, [activeTool, measureStartPt, measureEndPt, currentMouseProgPt, setLiveMeasure]);

  // Geometry actually drawn on the canvas: store objects with the uncommitted drag
  // overlaid. This keeps the store untouched during pointer-move (no per-frame G-code
  // regeneration) while still showing live feedback.
  const displayObjects = useMemo<CADObject[]>(() => {
    if (liveDrag.mode === 'translate') {
      const idset = new Set(liveDrag.ids);
      return objects.map((o) =>
        idset.has(o.id) ? translateObjectFull(o, liveDrag.dx, liveDrag.dy) : o
      );
    }
    if (liveDrag.mode === 'edit') {
      return objects.map((o) =>
        o.id === liveDrag.id ? ({ ...o, ...liveDrag.patch } as CADObject) : o
      );
    }
    return objects;
  }, [objects, liveDrag]);

  // Auto-fit canvas view
  const fitView = () => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const minX = Math.min(machine.bounds.xMin, machine.bounds.xMax);
    const maxX = Math.max(machine.bounds.xMin, machine.bounds.xMax);
    const minY = Math.min(machine.bounds.yMin, machine.bounds.yMax);
    const maxY = Math.max(machine.bounds.yMin, machine.bounds.yMax);

    const boundW = Math.abs(maxY - minY) || 1000;
    const boundH = Math.abs(maxX - minX) || 1000;

    const padding = 130;
    const zoomX = (width - padding) / boundW;
    const zoomY = (height - padding) / boundH;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.2), 3.0);

    const worldCenterX = (minX + maxX) / 2;
    const worldCenterY = (minY + maxY) / 2;

    const panX = width / 2 - worldCenterY * newZoom;
    const panY = height / 2 - worldCenterX * newZoom;

    setZoom(newZoom);
    setPan({ x: panX, y: panY });
  };

  useEffect(() => {
    fitView();
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        ((e.target as HTMLElement)?.isContentEditable ?? false);

      if (isInput) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          cancelDrawing();
          setActiveTool('select');
        }
        return;
      }

      const key = e.key.toLowerCase();
      const code = e.code;

      // ---- Dynamic distance input while a line / arc chord's first point is placed ----
      const ds = drawStateRef.current;
      const dynAnchor =
        ds.activeTool === 'line'
          ? ds.drawStartPt
          : ds.activeTool === 'arc' && !ds.drawArcEndPt
          ? ds.drawArcStartPt
          : null;
      if (dynAnchor) {
        const isDigit = e.key >= '0' && e.key <= '9';
        const isDecimal = e.key === '.' || e.key === ',';
        if (isDigit || (isDecimal && !ds.lineLengthInput.includes('.'))) {
          e.preventDefault();
          setLineLengthInput((prev) => (prev + (isDecimal ? '.' : e.key)).slice(0, 12));
          return;
        }
        if (e.key === 'Backspace' && ds.lineLengthInput.length > 0) {
          e.preventDefault();
          setLineLengthInput((prev) => prev.slice(0, -1));
          return;
        }
        if (e.key === 'Enter') {
          if (parseFloat(ds.lineLengthInput) > 0) {
            e.preventDefault();
            commitDynLength();
            return;
          }
        }
        if (e.key === 'Escape' && ds.lineLengthInput.length > 0) {
          e.preventDefault();
          setLineLengthInput('');
          return;
        }
      }

      if (e.key === 'Escape') {
        cancelDrawing();
        setActiveTool('select');
        setSelectedObjectId(null);
        setSelectedObjectIds([]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIds.length > 0) {
          deleteSelectedObjects();
        }
      } else if ((code === 'KeyS' || key === 's' || key === 'ы') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('select');
      } else if ((code === 'KeyH' || key === 'h' || key === 'р') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('point');
      } else if ((code === 'KeyL' || key === 'l' || key === 'д') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('line');
      } else if ((code === 'KeyR' || key === 'r' || key === 'к') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('rectangle');
      } else if ((code === 'KeyC' || key === 'c' || key === 'с') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('circle');
      } else if ((code === 'KeyA' || key === 'a' || key === 'ф') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('arc');
      } else if ((code === 'KeyM' || key === 'm' || key === 'ь') && !e.ctrlKey && !e.metaKey) {
        setActiveTool('measure');
      } else if ((code === 'KeyF' || key === 'f' || key === 'а') && !e.ctrlKey && !e.metaKey) {
        fitView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, activeTool, setActiveTool, setSelectedObjectId, setSelectedObjectIds, deleteSelectedObjects]);

  const cancelDrawing = () => {
    setDrawStartPt(null);
    setDrawArcStartPt(null);
    setDrawArcEndPt(null);
    setLineLengthInput('');
    setMeasureStartPt(null);
    setMeasureEndPt(null);
    setSelectionBoxStart(null);
    setSelectionBoxCurrent(null);
    setDragMode('none');
    setLiveDrag({ mode: 'none' });
    setDragIds([]);
    setDragObjInitial(null);
    setActiveSnapInfo(null);
    setLiveEdit(null);
    setLiveMeasure(null);
  };

  // Main canvas render loop
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // 1. Grid with Work Area Mask & Fade
    drawGrid(ctx, width, height, pan, zoom, gridStep, machine, palette);

    // 1b. Подложка — фоновая референсная картинка (поверх фона, под остальными слоями)
    drawUnderlay(ctx, underlayImgRef.current, underlay, pan, zoom);

    // 2. Machine Bounds & Stock
    drawMachineBoundsAndStock(ctx, machine, pan, zoom, palette);

    // 3. Axis Origin & Work Zero
    drawAxisOrigin(ctx, machine, pan, zoom, palette);

    // 4. G-Code Toolpaths (in Preview or Gcode mode)
    if (viewMode === 'preview' || viewMode === 'gcode') {
      drawToolpathSegments(ctx, toolpathSegments, pan, zoom);
    }

    // 5. CAD Objects
    drawCADObjects(ctx, displayObjects, selectedObjectIds, hoveredHandle, dragMode, pan, zoom, machine.toolDiameter, palette);

    // 5b. Selection Box Marquee
    if (dragMode === 'selection_box' && selectionBoxStart && selectionBoxCurrent) {
      drawSelectionBox(ctx, selectionBoxStart, selectionBoxCurrent);
    }

    // 6. Active Drawing Preview
    drawDrawingPreview(
      ctx,
      activeTool,
      drawStartPt,
      drawArcStartPt,
      drawArcEndPt,
      currentMouseProgPt,
      pan,
      zoom,
      machine.toolDiameter
    );

    // 6b. Measurement Tool Drawing
    if (activeTool === 'measure') {
      drawMeasurementTool(
        ctx,
        measureStartPt,
        measureEndPt,
        currentMouseProgPt,
        pan,
        zoom,
        palette
      );
    }

    // 7. O-SNAP Indicator
    if (activeSnapInfo) {
      drawSnapIndicator(ctx, activeSnapInfo, pan, zoom);
    }
  }, [
    pan,
    zoom,
    viewportVer,
    gridStep,
    displayObjects,
    selectedObjectId,
    selectedObjectIds,
    toolpathSegments,
    viewMode,
    activeTool,
    drawStartPt,
    drawArcStartPt,
    drawArcEndPt,
    currentMouseProgPt,
    measureStartPt,
    measureEndPt,
    hoveredHandle,
    activeSnapInfo,
    dragMode,
    selectionBoxStart,
    selectionBoxCurrent,
    machine,
    palette,
    underlay,
    underlayImgVer,
  ]);

  // Handle Press Down (mouse or single touch)
  const pointerDown = (e: CanvasPointer) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y, pan, zoom);

    // Middle click / Space or Pan
    if (e.button === 1) {
      setDragMode('pan');
      setDragStartCanvasPt(mousePx);
      return;
    }

    // Smart magnetic snap
    const { point: snapPt, snapInfo } = findMagneticSnapPoint(
      rawWorldPt,
      mousePx,
      objects,
      objectSnapEnabled,
      snapToGrid,
      gridStep,
      pan,
      zoom,
      undefined,
      undefined,
      machine
    );
    setActiveSnapInfo(snapInfo);

    // Active tool drawing dispatch
    if (activeTool === 'point') {
      addObject({
        name: `Отверстие ${objects.length + 1}`,
        type: 'point',
        x: snapPt.x,
        y: snapPt.y,
        diameter: 11,
        depth: 33,
        drillMode: '11mm',
        operationType: 'drill',
      });
      return;
    }

    if (activeTool === 'line') {
      if (!drawStartPt) {
        setDrawStartPt(clampToPosFaces(snapPt));
        setLineLengthInput('');
        setLineDirAngle(0);
      } else {
        // Priority: typed length > Shift-ortho/45° > free magnetic point.
        const L = parseFloat(lineLengthInput);
        let end: Point2D;
        if (L > 0) {
          end = pointFromPolar(drawStartPt, lineDirAngle, L);
        } else if (e.shiftKey) {
          end = constrainAngle(drawStartPt, snapPt, 45);
        } else {
          end = snapPt;
        }
        finishLineRef.current(end);
      }
      return;
    }

    if (activeTool === 'rectangle') {
      if (!drawStartPt) {
        setDrawStartPt(snapPt);
      } else {
        const x = Math.min(drawStartPt.x, snapPt.x);
        const y = Math.min(drawStartPt.y, snapPt.y);
        const w = Math.abs(snapPt.x - drawStartPt.x);
        const h = Math.abs(snapPt.y - drawStartPt.y);

        if (w > 0.1 && h > 0.1) {
          addObject({
            name: `Прямоугольник ${objects.length + 1}`,
            type: 'rectangle',
            x,
            y,
            width: w,
            height: h,
            depth: 5,
            operationType: 'cut',
          });
        }
        setDrawStartPt(null);
      }
      return;
    }

    if (activeTool === 'circle') {
      if (!drawStartPt) {
        setDrawStartPt(snapPt);
      } else {
        const r = Math.hypot(snapPt.x - drawStartPt.x, snapPt.y - drawStartPt.y);
        if (r > 0.5) {
          addObject({
            name: `Окружность R${r.toFixed(1)} (${objects.length + 1})`,
            type: 'circle',
            centerX: drawStartPt.x,
            centerY: drawStartPt.y,
            radius: r,
            depth: 5,
            operationType: 'cut',
          });
        }
        setDrawStartPt(null);
      }
      return;
    }

    if (activeTool === 'arc') {
      if (!drawArcStartPt) {
        setDrawArcStartPt(clampToPosFaces(snapPt));
        setLineLengthInput('');
        setLineDirAngle(0);
      } else if (!drawArcEndPt) {
        // End of chord: priority typed length > Shift-ortho/45° > free magnetic point.
        const L = parseFloat(lineLengthInput);
        let end: Point2D;
        if (L > 0) {
          end = pointFromPolar(drawArcStartPt, lineDirAngle, L);
        } else if (e.shiftKey) {
          end = constrainAngle(drawArcStartPt, snapPt, 45);
        } else {
          end = snapPt;
        }
        setDrawArcEndPt(clampRayToPosFaces(drawArcStartPt, end));
        setLineLengthInput('');
      } else {
        const arcData = getArcFrom3Points(drawArcStartPt, drawArcEndPt, snapPt);
        addObject({
          name: `Дуга R${arcData.radius.toFixed(1)} (${objects.length + 1})`,
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
      }
      return;
    }

    if (activeTool === 'measure') {
      if (!measureStartPt || (measureStartPt && measureEndPt)) {
        setMeasureStartPt(snapPt);
        setMeasureEndPt(null);
      } else {
        setMeasureEndPt(snapPt);
      }
      return;
    }

    // SELECT TOOL: Handle dragging or Object body dragging or Selection Box
    if (activeTool === 'select') {
      // 1. Check Handle Hit
      const handleHit = findHandleHit(objects, selectedObjectId, mousePx, pan, zoom);
      if (handleHit) {
        const targetObj = objects.find((o) => o.id === handleHit.objectId);
        if (targetObj) {
          setSelectedObjectId(targetObj.id);
          setDragMode(handleHit.type);
          setDragStartCanvasPt(mousePx);
          setDragStartWorldPt(snapPt);
          setDragObjInitial({ ...targetObj });
          setDragIds([]);
          setLiveDrag({ mode: 'none' });
          return;
        }
      }

      // 2. Check Object Body Hit
      const hitObjId = findObjectBodyHit(objects, rawWorldPt, zoom);
      if (hitObjId) {
        let currentSelectedIds = selectedObjectIds;
        if (e.shiftKey) {
          toggleObjectSelection(hitObjId);
          currentSelectedIds = selectedObjectIds.includes(hitObjId)
            ? selectedObjectIds.filter((id) => id !== hitObjId)
            : [...selectedObjectIds, hitObjId];
        } else {
          if (!selectedObjectIds.includes(hitObjId)) {
            setSelectedObjectIds([hitObjId]);
            currentSelectedIds = [hitObjId];
          }
        }

        // Body drag = pure translation of the selected set. Record which ids are being
        // dragged; the store stays untouched until mouseup (live overlay drives redraw).
        setDragMode('object');
        setDragStartCanvasPt(mousePx);
        setDragStartWorldPt(rawWorldPt);
        setDragObjInitial(null);
        setDragIds(currentSelectedIds);
        setLiveDrag({ mode: 'none' });
      } else if (underlay.src && underlay.visible && !underlay.frozen) {
        // 3. Подложка (фоновая картинка): сначала угол-ручка изменения размера, потом тело
        const uRect = getUnderlayCanvasRect(underlay, pan, zoom);
        const hs = UNDERLAY_HANDLE_PX;
        const hx = uRect.x + uRect.w;
        const hy = uRect.y + uRect.h;
        if (
          mousePx.x >= hx - hs &&
          mousePx.x <= hx + hs &&
          mousePx.y >= hy - hs &&
          mousePx.y <= hy + hs
        ) {
          underlayDragRef.current = {
            mode: 'resize',
            startWorld: rawWorldPt,
            origX: underlay.x,
            origY: underlay.y,
            origW: underlay.w,
            origH: underlay.h,
          };
          return;
        }
        if (
          mousePx.x >= uRect.x &&
          mousePx.x <= uRect.x + uRect.w &&
          mousePx.y >= uRect.y &&
          mousePx.y <= uRect.y + uRect.h
        ) {
          underlayDragRef.current = {
            mode: 'move',
            startWorld: rawWorldPt,
            origX: underlay.x,
            origY: underlay.y,
          };
          return;
        }
        // Промах мимо картинки — обычное рамочное выделение
        if (!e.shiftKey) {
          setSelectedObjectIds([]);
        }
        setDragMode('selection_box');
        setSelectionBoxStart(mousePx);
        setSelectionBoxCurrent(mousePx);
        setDragStartCanvasPt(mousePx);
      } else {
        // Clicked empty area
        if (!e.shiftKey) {
          setSelectedObjectIds([]);
        }
        setDragMode('selection_box');
        setSelectionBoxStart(mousePx);
        setSelectionBoxCurrent(mousePx);
        setDragStartCanvasPt(mousePx);
      }
    }
  };

  // Handle Move (mouse drag or single-finger drag)
  const pointerMove = (e: CanvasPointer) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y, pan, zoom);

    // 0. Подложка: перетаскивание / изменение размера фонового чертежа
    const uDrag = underlayDragRef.current;
    if (uDrag) {
      if (uDrag.mode === 'move') {
        const dx = rawWorldPt.x - uDrag.startWorld.x;
        const dy = rawWorldPt.y - uDrag.startWorld.y;
        updateUnderlay({ x: uDrag.origX + dx, y: uDrag.origY + dy });
      } else {
        const w = Math.max(1, rawWorldPt.x - uDrag.origX);
        const h = Math.max(1, rawWorldPt.y - uDrag.origY);
        updateUnderlay({ w, h });
      }
      setCurrentMouseProgPt(rawWorldPt);
      onCursorMove?.(rawWorldPt);
      return;
    }

    // 1. Pan Mode
    if (dragMode === 'pan') {
      const dx = mousePx.x - dragStartCanvasPt.x;
      const dy = mousePx.y - dragStartCanvasPt.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStartCanvasPt(mousePx);
      setCurrentMouseProgPt(rawWorldPt);
      onCursorMove?.(rawWorldPt);
      return;
    }

    // 1b. Selection Box Mode
    if (dragMode === 'selection_box') {
      setSelectionBoxCurrent(mousePx);
      setCurrentMouseProgPt(rawWorldPt);
      onCursorMove?.(rawWorldPt);
      return;
    }

    // 2. Magnetic Snap Update
    const { point: snapPt, snapInfo } = findMagneticSnapPoint(
      rawWorldPt,
      mousePx,
      objects,
      objectSnapEnabled,
      snapToGrid,
      gridStep,
      pan,
      zoom,
      selectedObjectId || undefined,
      dragMode,
      machine
    );
    setActiveSnapInfo(snapInfo);

    // Rubber-band for the line and the arc's start→end chord: track direction,
    // honour Shift 45°-polars, and reflect a typed distance live in the preview.
    let previewPt = snapPt;
    const dynAnchor =
      activeTool === 'line'
        ? drawStartPt
        : activeTool === 'arc' && drawArcStartPt && !drawArcEndPt
        ? drawArcStartPt
        : null;
    if (dynAnchor) {
      let ang = Math.atan2(snapPt.y - dynAnchor.y, snapPt.x - dynAnchor.x);
      if (e.shiftKey) {
        const constrained = constrainAngle(dynAnchor, snapPt, 45);
        ang = Math.atan2(constrained.y - dynAnchor.y, constrained.x - dynAnchor.x);
        previewPt = constrained;
      }
      setLineDirAngle(ang);
      const L = parseFloat(lineLengthInput);
      if (L > 0) {
        previewPt = pointFromPolar(dynAnchor, ang, L);
      }
      // Резинка не выходит за грани +X/+Y: конец «упирается» в ближайшую грань.
      previewPt = clampRayToPosFaces(dynAnchor, previewPt);
    }
    setCurrentMouseProgPt(previewPt);
    onCursorMove?.(previewPt);

    // 3. Handle Dragging — update the live overlay only (no store writes per frame)
    if (dragMode !== 'none') {
      if (dragMode === 'object' && dragIds.length > 0) {
        // Shift = вести перемещение строго по 90° (без 45°) относительно точки захвата.
        const anchorPt = e.shiftKey
          ? constrainAngle(dragStartWorldPt, snapPt, 90)
          : snapPt;
        const dx = anchorPt.x - dragStartWorldPt.x;
        const dy = anchorPt.y - dragStartWorldPt.y;
        setLiveDrag({ mode: 'translate', dx, dy, ids: dragIds });
      } else if (selectedObjectId && dragObjInitial) {
        if (dragMode === 'line_start' || dragMode === 'line_end') {
          // Shift = 45°/90°, Ctrl = только 90° — относительно неподвижной второй точки линии.
          let pt = snapPt;
          if (dragObjInitial.type === 'line' && (e.shiftKey || e.ctrlKey)) {
            const anchor =
              dragMode === 'line_start'
                ? { x: dragObjInitial.endX, y: dragObjInitial.endY }
                : { x: dragObjInitial.startX, y: dragObjInitial.startY };
            pt = constrainAngle(anchor, snapPt, e.shiftKey ? 45 : 90);
          }
          // Стенка: конец не вытягивается за грани +X/+Y (соскальзывает вдоль грани).
          pt = clampToPosFaces(pt);
          setLiveDrag(
            dragMode === 'line_start'
              ? { mode: 'edit', id: selectedObjectId, patch: { startX: pt.x, startY: pt.y } }
              : { mode: 'edit', id: selectedObjectId, patch: { endX: pt.x, endY: pt.y } }
          );
        } else if (dragObjInitial.type === 'arc') {
          const base = dragObjInitial;
          if (dragMode === 'arc_start') {
            const s = clampToPosFaces(snapPt);
            const r = Math.hypot(s.x - base.centerX, s.y - base.centerY);
            setLiveDrag({ mode: 'edit', id: selectedObjectId, patch: { startX: s.x, startY: s.y, radius: r } });
          } else if (dragMode === 'arc_end') {
            const s = clampToPosFaces(snapPt);
            const r = Math.hypot(s.x - base.centerX, s.y - base.centerY);
            setLiveDrag({ mode: 'edit', id: selectedObjectId, patch: { endX: s.x, endY: s.y, radius: r } });
          } else if (dragMode === 'arc_center') {
            const dx = snapPt.x - base.centerX;
            const dy = snapPt.y - base.centerY;
            setLiveDrag({
              mode: 'edit',
              id: selectedObjectId,
              patch: {
                centerX: snapPt.x,
                centerY: snapPt.y,
                startX: base.startX + dx,
                startY: base.startY + dy,
                endX: base.endX + dx,
                endY: base.endY + dy,
              },
            });
          }
        }
      }
      return;
    }

    // 4. Hover detection when not dragging
    if (activeTool === 'select') {
      const handleHit = findHandleHit(objects, selectedObjectId, mousePx, pan, zoom);
      if (handleHit) {
        setHoveredHandle({ objectId: handleHit.objectId, type: handleHit.type });
      } else {
        const bodyHitId = findObjectBodyHit(objects, rawWorldPt, zoom);
        if (bodyHitId) {
          setHoveredHandle({ objectId: bodyHitId, type: 'body' });
        } else {
          setHoveredHandle(null);
        }
      }
    }
  };

  const pointerUp = (e: CanvasPointer) => {
    // Подложка: геометрия уже пишется в стор на каждый move — просто завершаем жест.
    if (underlayDragRef.current) {
      underlayDragRef.current = null;
      return;
    }
    if (dragMode === 'selection_box') {
      if (selectionBoxStart && selectionBoxCurrent) {
        const distPx = Math.hypot(
          selectionBoxCurrent.x - selectionBoxStart.x,
          selectionBoxCurrent.y - selectionBoxStart.y
        );
        if (distPx > 3) {
          const w1 = canvasToWorld(selectionBoxStart.x, selectionBoxStart.y, pan, zoom);
          const w2 = canvasToWorld(selectionBoxCurrent.x, selectionBoxCurrent.y, pan, zoom);
          const box = {
            minX: Math.min(w1.x, w2.x),
            maxX: Math.max(w1.x, w2.x),
            minY: Math.min(w1.y, w2.y),
            maxY: Math.max(w1.y, w2.y),
          };

          const matchedIds = findObjectsInBox(objects, box);
          if (e.shiftKey) {
            const combined = Array.from(new Set([...selectedObjectIds, ...matchedIds]));
            setSelectedObjectIds(combined);
          } else {
            setSelectedObjectIds(matchedIds);
          }
        }
      }
      setSelectionBoxStart(null);
      setSelectionBoxCurrent(null);
    } else if (liveDrag.mode === 'translate') {
      // Commit the whole group translation in ONE store mutation (one history push + one
      // G-code regen), instead of one per selected object per mousemove. `objects` still
      // holds the pre-drag originals, so applying the full delta here is correct.
      const idset = new Set(liveDrag.ids);
      const updates = objects
        .filter((o) => idset.has(o.id))
        .map((o) => ({ id: o.id, patch: shiftCADObject(o, liveDrag.dx, liveDrag.dy) }));
      if (updates.length > 0) updateObjectsBulk(updates, true);
    } else if (liveDrag.mode === 'edit') {
      // Commit a single handle edit once (pushes one history entry).
      updateObject(liveDrag.id, liveDrag.patch, true);
    }
    // pan / plain click (liveDrag.mode === 'none'): no store write, no history entry.

    setDragMode('none');
    setDragObjInitial(null);
    setDragIds([]);
    setLiveDrag({ mode: 'none' });
  };

  const handleMouseLeave = () => {
    setCurrentMouseProgPt(null);
    setActiveSnapInfo(null);
    onCursorMove?.(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 15.0);

    const newPanX = mousePx.x - (mousePx.x - pan.x) * (newZoom / zoom);
    const newPanY = mousePx.y - (mousePx.y - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // ───────────────────────── Тач-жесты (телефон) ─────────────────────────
  // 1 палец = курсор (тап = клик,.drag = перетаскивание), 2 пальца = щипок-зум + панорама.
  const isMobile = useIsMobile();
  const touchModeRef = useRef<'none' | 'single' | 'pinch'>('none');
  const lastTouchTsRef = useRef(0);
  const pinchRef = useRef<{
    startDist: number;
    startMid: Point2D; // в px относительно канваса
    startZoom: number;
    startPan: Point2D;
  } | null>(null);

  // Отменить незавершённое одиночное перетаскивание при переходе к щипку (без коммита).
  const cancelPointerInteraction = () => {
    underlayDragRef.current = null;
    setDragMode('none');
    setLiveDrag({ mode: 'none' });
    setSelectionBoxStart(null);
    setSelectionBoxCurrent(null);
    setDragIds([]);
    setDragObjInitial(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouchTsRef.current = Date.now();
    if (e.touches.length >= 2) {
      touchModeRef.current = 'pinch';
      cancelPointerInteraction();
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      pinchRef.current = {
        startDist: Math.max(Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY), 1),
        startMid: {
          x: (t0.clientX + t1.clientX) / 2 - rect.left,
          y: (t0.clientY + t1.clientY) / 2 - rect.top,
        },
        startZoom: zoom,
        startPan: pan,
      };
      return;
    }
    if (e.touches.length === 1) {
      touchModeRef.current = 'single';
      const t = e.touches[0];
      pointerDown({ clientX: t.clientX, clientY: t.clientY, shiftKey: false, ctrlKey: false, button: 0 });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouchTsRef.current = Date.now();
    if (touchModeRef.current === 'pinch') {
      const g = pinchRef.current;
      if (!g || e.touches.length < 2 || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.max(Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY), 1);
      const mid = {
        x: (t0.clientX + t1.clientX) / 2 - rect.left,
        y: (t0.clientY + t1.clientY) / 2 - rect.top,
      };
      const newZoom = Math.min(Math.max(g.startZoom * (dist / g.startDist), 0.1), 15.0);
      const k = newZoom / g.startZoom;
      setZoom(newZoom);
      setPan({
        x: mid.x - (g.startMid.x - g.startPan.x) * k,
        y: mid.y - (g.startMid.y - g.startPan.y) * k,
      });
      return;
    }
    if (touchModeRef.current === 'single' && e.touches.length === 1) {
      const t = e.touches[0];
      pointerMove({ clientX: t.clientX, clientY: t.clientY, shiftKey: false, ctrlKey: false });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouchTsRef.current = Date.now();
    if (touchModeRef.current === 'pinch') {
      if (e.touches.length === 0) {
        touchModeRef.current = 'none';
        pinchRef.current = null;
      }
      // Один палец остался после щипка — ждём полного отпускания, чтобы не «прыгало».
      return;
    }
    if (touchModeRef.current === 'single' && e.touches.length === 0) {
      touchModeRef.current = 'none';
      const t = e.changedTouches[0];
      if (t) {
        pointerUp({ clientX: t.clientX, clientY: t.clientY, shiftKey: false, ctrlKey: false });
      }
      setCurrentMouseProgPt(null);
      setActiveSnapInfo(null);
    }
  };

  // Браузер после тапа генерирует «синтетические» mouse-события — глушим их,
  // чтобы каждый жест не выполнился дважды.
  const touchedRecently = () => Date.now() - lastTouchTsRef.current < 1500;
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (touchedRecently()) return;
    pointerDown(e);
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (touchedRecently()) return;
    pointerMove(e);
  };
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (touchedRecently()) return;
    pointerUp(e);
  };

  // Мобильная шторка открыта — поднимаем плавающую панель координат/масштаба над ней
  // (шторка занимает нижние 54% области холста, см. App.tsx).
  const controlsBottomStyle =
    isMobile && mobileSheet !== 'none' ? { bottom: 'calc(54% + 10px)' } : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#f1f5f9] dark:bg-[#0f172a] overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="w-full h-full cursor-crosshair block"
        style={{ touchAction: 'none' }}
      />

      <CanvasHud
        activeTool={activeTool}
        drawStartPt={drawStartPt}
        drawArcStartPt={drawArcStartPt}
        drawArcEndPt={drawArcEndPt}
        measureStartPt={measureStartPt}
        measureEndPt={measureEndPt}
        lineLengthInput={lineLengthInput}
        onCancelDraw={cancelDrawing}
        isMobile={isMobile}
        onLineLengthChange={setLineLengthInput}
        onDynCommit={commitDynLength}
      />

      <CanvasControls
        cursorPos={currentMouseProgPt}
        zoom={zoom}
        snapToGrid={snapToGrid}
        objectSnapEnabled={objectSnapEnabled}
        showTrajectory={viewMode === 'preview'}
        onZoomIn={() => setZoom((z) => Math.min(z * 1.2, 15))}
        onZoomOut={() => setZoom((z) => Math.max(z / 1.2, 0.1))}
        onFitView={fitView}
        onToggleTrajectory={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')}
        onToggleGridSnap={() => setSnapToGrid(!snapToGrid)}
        onToggleObjectSnap={() => setObjectSnapEnabled(!objectSnapEnabled)}
        bottomStyle={controlsBottomStyle}
      />
    </div>
  );
};

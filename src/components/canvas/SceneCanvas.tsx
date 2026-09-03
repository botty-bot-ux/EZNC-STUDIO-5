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
} from './canvasDrawers';
import {
  HoveredHandle,
  SnapPointInfo,
  canvasToWorld,
  getArcFrom3Points,
} from './canvasUtils';

interface SceneCanvasProps {
  onCursorMove?: (pt: Point2D | null) => void;
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
    }))
  );

  // Canvas Pan & Zoom
  const [pan, setPan] = useState<Point2D>({ x: 350, y: 350 });
  const [zoom, setZoom] = useState<number>(1.2);

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

  useEffect(() => {
    if (activeTool !== 'measure') {
      setMeasureStartPt(null);
      setMeasureEndPt(null);
    }
  }, [activeTool]);

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
    setMeasureStartPt(null);
    setMeasureEndPt(null);
    setSelectionBoxStart(null);
    setSelectionBoxCurrent(null);
    setDragMode('none');
    setLiveDrag({ mode: 'none' });
    setDragIds([]);
    setDragObjInitial(null);
    setActiveSnapInfo(null);
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
    drawGrid(ctx, width, height, pan, zoom, gridStep, machine);

    // 2. Machine Bounds & Stock
    drawMachineBoundsAndStock(ctx, machine, pan, zoom);

    // 3. Axis Origin & Work Zero
    drawAxisOrigin(ctx, machine, pan, zoom);

    // 4. G-Code Toolpaths (in Preview or Gcode mode)
    if (viewMode === 'preview' || viewMode === 'gcode') {
      drawToolpathSegments(ctx, toolpathSegments, pan, zoom);
    }

    // 5. CAD Objects
    drawCADObjects(ctx, displayObjects, selectedObjectIds, hoveredHandle, dragMode, pan, zoom, machine.toolDiameter);

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
        zoom
      );
    }

    // 7. O-SNAP Indicator
    if (activeSnapInfo) {
      drawSnapIndicator(ctx, activeSnapInfo, pan, zoom);
    }
  }, [
    pan,
    zoom,
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
  ]);

  // Handle Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y, pan, zoom);

    // Middle click / Space or Pan
    if (e.button === 1 || e.buttons === 4) {
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
        setDrawStartPt(snapPt);
      } else {
        addObject({
          name: `Отрезок ${objects.length + 1}`,
          type: 'line',
          startX: drawStartPt.x,
          startY: drawStartPt.y,
          endX: snapPt.x,
          endY: snapPt.y,
          depth: 5,
          operationType: 'cut',
        });
        setDrawStartPt(null);
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
        setDrawArcStartPt(snapPt);
      } else if (!drawArcEndPt) {
        setDrawArcEndPt(snapPt);
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

  // Handle Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y, pan, zoom);

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
    setCurrentMouseProgPt(snapPt);
    onCursorMove?.(snapPt);

    // 3. Handle Dragging — update the live overlay only (no store writes per frame)
    if (dragMode !== 'none') {
      if (dragMode === 'object' && dragIds.length > 0) {
        const dx = snapPt.x - dragStartWorldPt.x;
        const dy = snapPt.y - dragStartWorldPt.y;
        setLiveDrag({ mode: 'translate', dx, dy, ids: dragIds });
      } else if (selectedObjectId && dragObjInitial) {
        if (dragMode === 'line_start') {
          setLiveDrag({ mode: 'edit', id: selectedObjectId, patch: { startX: snapPt.x, startY: snapPt.y } });
        } else if (dragMode === 'line_end') {
          setLiveDrag({ mode: 'edit', id: selectedObjectId, patch: { endX: snapPt.x, endY: snapPt.y } });
        } else if (dragObjInitial.type === 'arc') {
          const base = dragObjInitial;
          if (dragMode === 'arc_start') {
            const r = Math.hypot(snapPt.x - base.centerX, snapPt.y - base.centerY);
            setLiveDrag({ mode: 'edit', id: selectedObjectId, patch: { startX: snapPt.x, startY: snapPt.y, radius: r } });
          } else if (dragMode === 'arc_end') {
            const r = Math.hypot(snapPt.x - base.centerX, snapPt.y - base.centerY);
            setLiveDrag({ mode: 'edit', id: selectedObjectId, patch: { endX: snapPt.x, endY: snapPt.y, radius: r } });
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

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

  const selectedObj = displayObjects.find((o) => o.id === selectedObjectId);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#f1f5f9] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        className="w-full h-full cursor-crosshair block"
      />

      <CanvasHud
        activeTool={activeTool}
        drawStartPt={drawStartPt}
        drawArcStartPt={drawArcStartPt}
        drawArcEndPt={drawArcEndPt}
        measureStartPt={measureStartPt}
        measureEndPt={measureEndPt}
        dragMode={dragMode}
        dragTargetObj={selectedObj}
        currentMouseProgPt={currentMouseProgPt}
        onCancelDraw={cancelDrawing}
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
      />
    </div>
  );
};

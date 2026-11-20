import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleDot, FileUp, LineDotRightHorizontal, Square } from 'lucide-react';
import { useSelectedObjectId } from '../../store/useProjectStore';
import { isRailMachine } from '../../store/initialState';
import { CADObject, FilletPreviewState, Point2D, TrimPreviewState } from '../../types';
import { CanvasControls, CursorSubscribeFn } from './CanvasControls';
import { CanvasHud } from './CanvasHud';
import { ArcModeSelector } from './ArcModeSelector';
import { LineModeSelector } from './LineModeSelector';
import { FilletModeSelector } from './FilletModeSelector';
import { ShapeContextMenu } from './ShapeContextMenu';
import {
  DragMode,
  findHandleHit,
  findMagneticSnapPoint,
  findObjectBodyHit,
  findObjectsInBox,
} from './canvasHitTest';
import {
  clampRayToPosFaces,
  computeDisplayObjects,
  computeNodeEditItems,
  pointFromPolar,
} from './sceneCanvasGeometry';
import { CanvasPointer, LiveDrag, SceneCanvasProps } from './sceneCanvas.types';
import { drawScene } from './sceneCanvasRender';
import { useCanvasStore } from './useCanvasStore';
import { useCanvasViewport } from './useCanvasViewport';
import { useCanvasUnderlay } from './useCanvasUnderlay';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import { useCanvasGestures } from './useCanvasGestures';
import { evaluateToolHover, handleDrawingToolDown } from './canvasToolHandlers';
import {
  HoveredHandle,
  SnapPointInfo,
  canvasToWorld,
  worldToCanvas,
} from './canvasUtils';
import { paletteForTheme } from './canvasPalette';
import { constrainAngle, translateCADObject } from '../../lib/geometry/transform';
import { analyzeTrajectoryBounds } from '../../lib/geometry/bounds';
import { useIsMobile } from '../../hooks/useIsMobile';

export const SceneCanvas: React.FC<SceneCanvasProps> = ({ onCursorMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();

  const {
    objects,
    selectedObjectIds,
    setSelectedObjectId,
    setSelectedObjectIds,
    toggleObjectSelection,
    addObject,
    updateObjectsBulk,
    deleteSelectedObjects,
    copySelectedObjects,
    pasteClipboard,
    machine,
    toolpathSegments,
    viewMode,
    setViewMode,
    activeTool,
    setActiveTool,
    filletRadius,
    setFilletRadius,
    arcMode,
    setArcMode,
    lineMode,
    setLineMode,
    setCanvasGrabbing,
    snapToGrid,
    setSnapToGrid,
    gridStep,
    setGridStep,
    setLiveEdit,
    setLiveMeasure,
    liveMove,
    liveScale,
    liveRotate,
    parallelPreview,
    trimObjectAtPoint,
    filletLines,
    filletRectangle,
    underlay,
    updateUnderlay,
    mobileSheet,
    theme,
    gcodeScrollPreview,
    canvasFocusRequest,
    canvasFitSeq,
    setShapeDialog,
  } = useCanvasStore();

  const selectedObjectId = useSelectedObjectId();
  const palette = useMemo(() => paletteForTheme(theme), [theme]);

  // ── Камера и подложка ──────────────────────────────────────────────
  const { pan, setPan, zoom, setZoom, viewportVer, fitView, zoomAtCenter } = useCanvasViewport({
    containerRef,
    canvasRef,
    machine,
    canvasFocusRequest,
    canvasFitSeq,
  });

  const {
    underlayImgRef,
    underlayImgVer,
    tryStartDrag: tryStartUnderlayDrag,
    handleMove: handleUnderlayMove,
    handleUp: handleUnderlayUp,
    cancelDrag: cancelUnderlayDrag,
  } = useCanvasUnderlay(underlay, updateUnderlay);

  // ── Реактивное состояние UI / дискретных этапов инструментов ───────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [objectSnapEnabled, setObjectSnapEnabled] = useState<boolean>(true);
  const [dragMode, setDragMode] = useState<DragMode>('none');

  const [drawStartPt, setDrawStartPt] = useState<Point2D | null>(null);
  const [drawArcStartPt, setDrawArcStartPt] = useState<Point2D | null>(null);
  const [drawArcEndPt, setDrawArcEndPt] = useState<Point2D | null>(null);
  const [polyPts, setPolyPts] = useState<Point2D[]>([]);
  const [measureStartPt, setMeasureStartPt] = useState<Point2D | null>(null);
  const [measureEndPt, setMeasureEndPt] = useState<Point2D | null>(null);
  const [filletFirstPick, setFilletFirstPick] = useState<{ id: string; clickPt: Point2D } | null>(null);
  const [toolStatusHint, setToolStatusHint] = useState<string | null>(null);
  const [lineLengthInput, setLineLengthInput] = useState<string>('');
  const [dynAnchorPx, setDynAnchorPx] = useState<Point2D | null>(null);

  const toolStatusHintRef = useRef<string | null>(null);
  const setHintIfChanged = useCallback((next: string | null) => {
    if (toolStatusHintRef.current !== next) {
      toolStatusHintRef.current = next;
      setToolStatusHint(next);
    }
  }, []);

  // ── Высокочастотное состояние холста на refs + rAF (без ререндеров на каждый mousemove) ──
  const activeSnapInfoRef = useRef<SnapPointInfo | null>(null);
  const hoveredHandleRef = useRef<HoveredHandle | null>(null);
  const trimPreviewRef = useRef<TrimPreviewState | null>(null);
  const filletPreviewRef = useRef<FilletPreviewState | null>(null);
  const selectionBoxStartRef = useRef<Point2D | null>(null);
  const selectionBoxCurrentRef = useRef<Point2D | null>(null);
  const liveDragRef = useRef<LiveDrag>({ mode: 'none' });
  const dragStartCanvasPtRef = useRef<Point2D>({ x: 0, y: 0 });
  const dragStartWorldPtRef = useRef<Point2D>({ x: 0, y: 0 });
  const dragObjInitialRef = useRef<CADObject | null>(null);
  const dragIdsRef = useRef<string[]>([]);
  const lineDirAngleRef = useRef<number>(0);
  const currentMouseProgPtRef = useRef<Point2D | null>(null);

  // Императивная подписка для строки координат курсора в CanvasControls
  const cursorListenersRef = useRef<Set<(pt: Point2D | null) => void>>(new Set());
  const cursorSubscribe = useCallback<CursorSubscribeFn>((listener) => {
    cursorListenersRef.current.add(listener);
    listener(currentMouseProgPtRef.current);
    return () => {
      cursorListenersRef.current.delete(listener);
    };
  }, []);

  const isDynAnchorActive =
    activeTool === 'line'
      ? !!drawStartPt
      : activeTool === 'arc'
      ? !!drawArcStartPt && !drawArcEndPt
      : false;

  const notifyCursor = useCallback(
    (pt: Point2D | null) => {
      currentMouseProgPtRef.current = pt;
      cursorListenersRef.current.forEach((fn) => fn(pt));
      onCursorMove?.(pt);
      if (isDynAnchorActive) {
        setDynAnchorPx(pt ? worldToCanvas(pt.x, pt.y, pan, zoom) : null);
      }
      if (activeTool === 'measure' && measureStartPt && !measureEndPt) {
        setLiveMeasure(pt ? { start: measureStartPt, end: pt } : null);
      }
    },
    [onCursorMove, isDynAnchorActive, pan, zoom, activeTool, measureStartPt, measureEndPt, setLiveMeasure]
  );

  useEffect(() => {
    if (!isDynAnchorActive) {
      setDynAnchorPx(null);
    } else if (currentMouseProgPtRef.current) {
      setDynAnchorPx(
        worldToCanvas(currentMouseProgPtRef.current.x, currentMouseProgPtRef.current.y, pan, zoom)
      );
    }
  }, [isDynAnchorActive, pan, zoom]);

  // ── Базовые объекты для превью модалок и габаритов стола ───────────
  const modalPreviewObjects = useMemo<CADObject[]>(
    () =>
      computeDisplayObjects({
        objects,
        liveDrag: { mode: 'none' },
        liveMove,
        liveScale,
        liveRotate,
      }),
    [objects, liveMove, liveScale, liveRotate]
  );

  const isModalLivePreview =
    Boolean(liveMove && liveMove.ids.length > 0 && (liveMove.dx !== 0 || liveMove.dy !== 0)) ||
    Boolean(liveScale && liveScale.ids.length > 0 && (liveScale.sx !== 1 || liveScale.sy !== 1)) ||
    Boolean(liveRotate && liveRotate.ids.length > 0 && Math.abs(liveRotate.angleDeg) > 1e-6);

  const boundsSummary = useMemo(
    () =>
      analyzeTrajectoryBounds(
        isModalLivePreview ? [] : toolpathSegments,
        machine,
        modalPreviewObjects
      ),
    [isModalLivePreview, toolpathSegments, machine, modalPreviewObjects]
  );

  // ── Движок отрисовки на rAF ────────────────────────────────────────
  const rafIdRef = useRef<number | null>(null);
  const paintNowRef = useRef<() => void>(() => {});

  paintNowRef.current = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const liveDrag = liveDragRef.current;
    const displayObjects =
      liveDrag.mode === 'none'
        ? modalPreviewObjects
        : computeDisplayObjects({ objects, liveDrag, liveMove, liveScale, liveRotate });

    drawScene({
      ctx,
      width,
      height,
      pan,
      zoom,
      gridStep,
      machine,
      palette,
      underlayImg: underlayImgRef.current,
      underlay,
      viewMode,
      toolpathSegments,
      displayObjects,
      selectedObjectIds,
      hoveredHandle: hoveredHandleRef.current,
      dragMode,
      parallelPreview,
      selectionBoxStart: selectionBoxStartRef.current,
      selectionBoxCurrent: selectionBoxCurrentRef.current,
      activeTool,
      drawStartPt,
      drawArcStartPt,
      drawArcEndPt,
      currentMouseProgPt: currentMouseProgPtRef.current,
      arcMode,
      lineMode,
      polyPts,
      measureStartPt,
      measureEndPt,
      activeSnapInfo: activeSnapInfoRef.current,
      gcodeScrollPreview,
      boundsSummary,
      trimPreview: trimPreviewRef.current,
      filletPreview: filletPreviewRef.current,
    });
  };

  const scheduleDraw = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      paintNowRef.current();
    });
  }, []);

  useEffect(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    paintNowRef.current();
  }, [
    pan,
    zoom,
    viewportVer,
    gridStep,
    modalPreviewObjects,
    selectedObjectId,
    selectedObjectIds,
    parallelPreview,
    toolpathSegments,
    viewMode,
    activeTool,
    arcMode,
    lineMode,
    polyPts,
    drawStartPt,
    drawArcStartPt,
    drawArcEndPt,
    measureStartPt,
    measureEndPt,
    dragMode,
    machine,
    palette,
    underlay,
    underlayImgVer,
    gcodeScrollPreview,
    boundsSummary,
  ]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // ── Завершение линии / полилинии / DYN-ввода ───────────────────────
  const drawStateRef = useRef({
    activeTool,
    lineMode,
    drawStartPt,
    drawArcStartPt,
    drawArcEndPt,
    polyPts,
    lineLengthInput,
  });
  drawStateRef.current = {
    activeTool,
    lineMode,
    drawStartPt,
    drawArcStartPt,
    drawArcEndPt,
    polyPts,
    lineLengthInput,
  };

  const finishLine = useCallback(
    (end: Point2D) => {
      if (!drawStartPt) return;
      const clamped = clampRayToPosFaces(drawStartPt, end);
      if (Math.hypot(clamped.x - drawStartPt.x, clamped.y - drawStartPt.y) < 0.1) {
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
    },
    [drawStartPt, addObject, objects.length]
  );

  const commitPolyline = useCallback(() => {
    if (polyPts.length < 2) {
      setPolyPts([]);
      return;
    }
    const closed = lineMode === 'polygon';
    addObject({
      name: `${closed ? 'Контур' : 'Полилиния'} ${objects.length + 1}`,
      type: 'polyline',
      points: polyPts,
      closed,
      depth: 5,
      operationType: 'cut',
    });
    setPolyPts([]);
    setLineLengthInput('');
  }, [polyPts, lineMode, addObject, objects.length]);

  const finishLineRef = useRef(finishLine);
  finishLineRef.current = finishLine;
  const commitPolylineRef = useRef(commitPolyline);
  commitPolylineRef.current = commitPolyline;

  const commitDynLength = useCallback(() => {
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
    const end = pointFromPolar(anchor, lineDirAngleRef.current, L);
    if (ds.activeTool === 'arc') {
      setDrawArcEndPt(clampRayToPosFaces(anchor, end));
      setLineLengthInput('');
    } else {
      finishLineRef.current(end);
    }
  }, []);

  const commitDynLengthRef = useRef(commitDynLength);
  commitDynLengthRef.current = commitDynLength;

  const cancelDrawing = useCallback(() => {
    setDrawStartPt(null);
    setDrawArcStartPt(null);
    setDrawArcEndPt(null);
    setPolyPts([]);
    setLineLengthInput('');
    setMeasureStartPt(null);
    setMeasureEndPt(null);
    setFilletFirstPick(null);
    setHintIfChanged(null);
    setDragMode('none');
    trimPreviewRef.current = null;
    filletPreviewRef.current = null;
    selectionBoxStartRef.current = null;
    selectionBoxCurrentRef.current = null;
    liveDragRef.current = { mode: 'none' };
    dragIdsRef.current = [];
    dragObjInitialRef.current = null;
    activeSnapInfoRef.current = null;
    hoveredHandleRef.current = null;
    setLiveEdit(null);
    setLiveMeasure(null);
    scheduleDraw();
  }, [setHintIfChanged, setLiveEdit, setLiveMeasure, scheduleDraw]);

  const cancelDrawingRef = useRef(cancelDrawing);
  cancelDrawingRef.current = cancelDrawing;

  // Сброс незавершённых состояний при смене инструмента
  useEffect(() => {
    if (activeTool !== 'measure') {
      setMeasureStartPt(null);
      setMeasureEndPt(null);
    }
    if (activeTool !== 'line') setPolyPts([]);
    if (activeTool !== 'trim') trimPreviewRef.current = null;
    if (activeTool !== 'fillet') {
      setFilletFirstPick(null);
      filletPreviewRef.current = null;
    }
    setHintIfChanged(null);
    if (activeTool !== 'select') hoveredHandleRef.current = null;
    scheduleDraw();
  }, [activeTool, setHintIfChanged, scheduleDraw]);

  // Флаг активного жеста для отключения pointer-events у плавающих панелей
  useEffect(() => {
    const drawing =
      (activeTool === 'line' && (lineMode === 'line' ? !!drawStartPt : polyPts.length > 0)) ||
      (activeTool === 'arc' && !!drawArcStartPt) ||
      (activeTool === 'rectangle' && !!drawStartPt) ||
      (activeTool === 'circle' && !!drawStartPt) ||
      (activeTool === 'measure' && !!measureStartPt && !measureEndPt);
    setCanvasGrabbing(dragMode !== 'none' || drawing);
  }, [
    dragMode,
    activeTool,
    lineMode,
    drawStartPt,
    drawArcStartPt,
    polyPts,
    measureStartPt,
    measureEndPt,
    setCanvasGrabbing,
  ]);

  // Синхронизация линейки в стор при фиксации конечной точки или сбросе
  useEffect(() => {
    if (activeTool === 'measure' && measureStartPt) {
      const end = measureEndPt ?? currentMouseProgPtRef.current;
      setLiveMeasure(end ? { start: measureStartPt, end } : null);
    } else {
      setLiveMeasure(null);
    }
  }, [activeTool, measureStartPt, measureEndPt, setLiveMeasure]);

  // Горячие клавиши холста
  useCanvasKeyboard({
    drawStateRef,
    selectedObjectIds,
    setActiveTool,
    setSelectedObjectId,
    setSelectedObjectIds,
    deleteSelectedObjects,
    copySelectedObjects,
    pasteClipboard,
    setLineLengthInput,
    setPolyPts,
    commitDynLengthRef,
    commitPolylineRef,
    cancelDrawingRef,
    fitView,
  });

  // ── Обработчики указателя (мышь / 1 палец) ─────────────────────────
  const pointerDown = (e: CanvasPointer) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y, pan, zoom);

    if (e.button === 1) {
      setDragMode('pan');
      dragStartCanvasPtRef.current = mousePx;
      return;
    }

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
    activeSnapInfoRef.current = snapInfo;

    const handledDrawing = handleDrawingToolDown({
      activeTool,
      snapPt,
      shiftKey: e.shiftKey,
      zoom,
      objectsCount: objects.length,
      lineMode,
      arcMode,
      drawStartPt,
      drawArcStartPt,
      drawArcEndPt,
      polyPts,
      measureStartPt,
      measureEndPt,
      lineLengthInput,
      lineDirAngle: lineDirAngleRef.current,
      addObject,
      setDrawStartPt,
      setDrawArcStartPt,
      setDrawArcEndPt,
      setPolyPts,
      setMeasureStartPt,
      setMeasureEndPt,
      setLineLengthInput,
      setLineDirAngle: (ang) => {
        lineDirAngleRef.current = ang;
      },
      finishLine,
      commitPolyline,
    });
    if (handledDrawing) {
      scheduleDraw();
      return;
    }

    if (activeTool === 'trim') {
      activeSnapInfoRef.current = null;
      const hitId = findObjectBodyHit(objects, rawWorldPt, zoom);
      if (!hitId) {
        setHintIfChanged('Кликните по пересечённому отрезку, дуге или окружности');
        scheduleDraw();
        return;
      }
      const trimmed = trimObjectAtPoint(hitId, rawWorldPt);
      if (trimmed) {
        trimPreviewRef.current = null;
        hoveredHandleRef.current = null;
        setHintIfChanged(null);
      } else {
        setHintIfChanged('Нет пересечений для обрезки этой фигуры');
      }
      scheduleDraw();
      return;
    }

    if (activeTool === 'fillet') {
      activeSnapInfoRef.current = null;
      const hitId = findObjectBodyHit(objects, rawWorldPt, zoom);
      const hitObj = hitId ? objects.find((o) => o.id === hitId) : null;

      if (!hitObj) {
        if (filletFirstPick) {
          setFilletFirstPick(null);
          filletPreviewRef.current = null;
        }
        setHintIfChanged(null);
        scheduleDraw();
        return;
      }
      if (!filletFirstPick && hitObj.type === 'rectangle') {
        const res = filletRectangle(hitObj.id, filletRadius);
        setHintIfChanged(res.ok ? null : res.reason ?? 'Не удалось скруглить прямоугольник');
        return;
      }
      if (hitObj.type !== 'line') {
        setHintIfChanged('Выберите отрезок или прямоугольник для скругления');
        return;
      }
      if (hitObj.frozen) {
        setHintIfChanged('Отрезок зафиксирован от изменений');
        return;
      }
      if (!filletFirstPick) {
        setFilletFirstPick({ id: hitObj.id, clickPt: rawWorldPt });
        filletPreviewRef.current = null;
        setHintIfChanged(null);
        scheduleDraw();
        return;
      }
      if (filletFirstPick.id === hitObj.id) {
        setFilletFirstPick(null);
        filletPreviewRef.current = null;
        setHintIfChanged(null);
        scheduleDraw();
        return;
      }
      const res = filletLines(
        filletFirstPick.id,
        hitObj.id,
        filletRadius,
        filletFirstPick.clickPt,
        rawWorldPt
      );
      if (res.ok) {
        setFilletFirstPick(null);
        filletPreviewRef.current = null;
        setHintIfChanged(null);
      } else {
        setHintIfChanged(res.reason ?? 'Не удалось построить скругление');
      }
      scheduleDraw();
      return;
    }

    // Инструмент «Выбор»: гриф → тело фигуры → подложка → рамочное выделение
    if (activeTool === 'select') {
      const handleHit = findHandleHit(objects, selectedObjectIds, mousePx, pan, zoom);
      if (handleHit) {
        const targetObj = objects.find((o) => o.id === handleHit.objectId);
        if (targetObj) {
          const group = selectedObjectIds.includes(targetObj.id)
            ? [...selectedObjectIds.filter((id) => id !== targetObj.id), targetObj.id]
            : [targetObj.id];
          setSelectedObjectIds(group);
          const frozen = new Set(objects.filter((o) => o.frozen).map((o) => o.id));
          setDragMode(handleHit.type);
          dragStartCanvasPtRef.current = mousePx;
          dragStartWorldPtRef.current = snapPt;
          dragObjInitialRef.current = { ...targetObj };
          dragIdsRef.current = group.filter((id) => !frozen.has(id));
          liveDragRef.current = { mode: 'none' };
          return;
        }
      }

      const hitObjId = findObjectBodyHit(objects, rawWorldPt, zoom);
      if (hitObjId) {
        let currentSelectedIds = selectedObjectIds;
        if (e.shiftKey) {
          toggleObjectSelection(hitObjId);
          currentSelectedIds = selectedObjectIds.includes(hitObjId)
            ? selectedObjectIds.filter((id) => id !== hitObjId)
            : [...selectedObjectIds, hitObjId];
        } else if (!selectedObjectIds.includes(hitObjId)) {
          setSelectedObjectIds([hitObjId]);
          currentSelectedIds = [hitObjId];
        }

        const frozenIds = new Set(objects.filter((o) => o.frozen).map((o) => o.id));
        setDragMode('object');
        dragStartCanvasPtRef.current = mousePx;
        dragStartWorldPtRef.current = rawWorldPt;
        dragObjInitialRef.current = null;
        dragIdsRef.current = currentSelectedIds.filter((id) => !frozenIds.has(id));
        liveDragRef.current = { mode: 'none' };
        return;
      }

      if (tryStartUnderlayDrag(mousePx, rawWorldPt, pan, zoom)) {
        return;
      }

      if (!e.shiftKey) setSelectedObjectIds([]);
      setDragMode('selection_box');
      selectionBoxStartRef.current = mousePx;
      selectionBoxCurrentRef.current = mousePx;
      dragStartCanvasPtRef.current = mousePx;
      scheduleDraw();
    }
  };

  const pointerMove = (e: CanvasPointer) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorldPt = canvasToWorld(mousePx.x, mousePx.y, pan, zoom);

    // 0. Подложка
    if (handleUnderlayMove(rawWorldPt)) {
      notifyCursor(rawWorldPt);
      return;
    }

    // 1. Панорамирование
    if (dragMode === 'pan') {
      const dx = mousePx.x - dragStartCanvasPtRef.current.x;
      const dy = mousePx.y - dragStartCanvasPtRef.current.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      dragStartCanvasPtRef.current = mousePx;
      notifyCursor(rawWorldPt);
      return;
    }

    // 1b. Рамка выделения
    if (dragMode === 'selection_box') {
      selectionBoxCurrentRef.current = mousePx;
      notifyCursor(rawWorldPt);
      scheduleDraw();
      return;
    }

    // 2. Магнитная привязка
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
    activeSnapInfoRef.current = snapInfo;

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
      lineDirAngleRef.current = ang;
      const L = parseFloat(lineLengthInput);
      if (L > 0) previewPt = pointFromPolar(dynAnchor, ang, L);
      previewPt = clampRayToPosFaces(dynAnchor, previewPt);
    }
    notifyCursor(previewPt);

    // 3. Активное перетаскивание объекта или узла (только ref + rAF — без мутаций стора)
    if (dragMode !== 'none') {
      const dragIds = dragIdsRef.current;
      if (dragMode === 'object' && dragIds.length > 0) {
        const anchorPt = e.shiftKey
          ? constrainAngle(dragStartWorldPtRef.current, snapPt, 90)
          : snapPt;
        const dx = anchorPt.x - dragStartWorldPtRef.current.x;
        const dy = anchorPt.y - dragStartWorldPtRef.current.y;
        liveDragRef.current = { mode: 'translate', dx, dy, ids: dragIds };
      } else if (dragIds.length > 0 && dragObjInitialRef.current) {
        const items = computeNodeEditItems({
          objects,
          dragIds,
          base: dragObjInitialRef.current,
          dragMode,
          snapPt,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          zoom,
        });
        if (items) {
          liveDragRef.current = { mode: 'edit', items };
          if (items.length > 0) {
            const anchor = items.find((i) => i.id === selectedObjectId) ?? items[0];
            setLiveEdit({ id: anchor.id, patch: anchor.patch });
          }
        }
      }
      scheduleDraw();
      return;
    }

    // 4. Подсветка наведения (trim / fillet / select)
    const hover = evaluateToolHover({
      activeTool,
      objects,
      selectedObjectIds,
      mousePx,
      rawWorldPt,
      pan,
      zoom,
      filletFirstPick,
      filletRadius,
    });
    if (hover) {
      if (hover.clearSnap) activeSnapInfoRef.current = null;
      hoveredHandleRef.current = hover.hoveredHandle;
      trimPreviewRef.current = hover.trimPreview;
      filletPreviewRef.current = hover.filletPreview;
      if (hover.statusHint !== undefined) setHintIfChanged(hover.statusHint);
    }
    scheduleDraw();
  };

  const pointerUp = (e: CanvasPointer) => {
    if (handleUnderlayUp()) return;

    const liveDrag = liveDragRef.current;
    if (dragMode === 'selection_box') {
      const boxStart = selectionBoxStartRef.current;
      const boxCurr = selectionBoxCurrentRef.current;
      if (boxStart && boxCurr) {
        const distPx = Math.hypot(boxCurr.x - boxStart.x, boxCurr.y - boxStart.y);
        if (distPx > 3) {
          const w1 = canvasToWorld(boxStart.x, boxStart.y, pan, zoom);
          const w2 = canvasToWorld(boxCurr.x, boxCurr.y, pan, zoom);
          const matchedIds = findObjectsInBox(objects, {
            minX: Math.min(w1.x, w2.x),
            maxX: Math.max(w1.x, w2.x),
            minY: Math.min(w1.y, w2.y),
            maxY: Math.max(w1.y, w2.y),
          });
          setSelectedObjectIds(
            e.shiftKey ? Array.from(new Set([...selectedObjectIds, ...matchedIds])) : matchedIds
          );
        }
      }
      selectionBoxStartRef.current = null;
      selectionBoxCurrentRef.current = null;
    } else if (liveDrag.mode === 'translate') {
      const idset = new Set(liveDrag.ids);
      const updates = objects
        .filter((o) => idset.has(o.id))
        .map((o) => ({ id: o.id, patch: translateCADObject(o, liveDrag.dx, liveDrag.dy) }));
      if (updates.length > 0) updateObjectsBulk(updates, true);
    } else if (liveDrag.mode === 'edit') {
      if (liveDrag.items.length > 0) updateObjectsBulk(liveDrag.items, true);
      setLiveEdit(null);
    }

    setDragMode('none');
    dragObjInitialRef.current = null;
    dragIdsRef.current = [];
    liveDragRef.current = { mode: 'none' };
    scheduleDraw();
  };

  const pointerUpRef = useRef(pointerUp);
  pointerUpRef.current = pointerUp;

  // Страховка: если мышь отпустили вне холста, завершаем жест без залипания
  useEffect(() => {
    if (dragMode === 'none') return;
    const onWinUp = (ev: MouseEvent) => {
      if (canvasRef.current && ev.target === canvasRef.current) return;
      pointerUpRef.current({
        clientX: ev.clientX,
        clientY: ev.clientY,
        shiftKey: ev.shiftKey,
        ctrlKey: ev.ctrlKey,
      });
    };
    window.addEventListener('mouseup', onWinUp);
    return () => window.removeEventListener('mouseup', onWinUp);
  }, [dragMode]);

  const handleMouseLeave = () => {
    activeSnapInfoRef.current = null;
    notifyCursor(null);
    scheduleDraw();
  };

  const cancelPointerInteraction = () => {
    cancelUnderlayDrag();
    setDragMode('none');
    liveDragRef.current = { mode: 'none' };
    selectionBoxStartRef.current = null;
    selectionBoxCurrentRef.current = null;
    dragIdsRef.current = [];
    dragObjInitialRef.current = null;
    setLiveEdit(null);
    scheduleDraw();
  };

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useCanvasGestures({
    canvasRef,
    pan,
    zoom,
    setPan,
    setZoom,
    onPointerDown: pointerDown,
    onPointerMove: pointerMove,
    onPointerUp: pointerUp,
    onCancelInteraction: cancelPointerInteraction,
    onTouchPointerCleared: () => {
      activeSnapInfoRef.current = null;
      notifyCursor(null);
      scheduleDraw();
    },
  });

  const controlsBottomStyle =
    isMobile && mobileSheet !== 'none' ? { bottom: 'calc(58% + 10px)' } : undefined;

  const controlsEl = (
    <CanvasControls
      cursorSubscribe={cursorSubscribe}
      snapToGrid={snapToGrid}
      objectSnapEnabled={objectSnapEnabled}
      showTrajectory={viewMode === 'preview'}
      gridStep={gridStep}
      zoom={zoom}
      onToggleTrajectory={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')}
      onToggleGridSnap={() => setSnapToGrid(!snapToGrid)}
      onGridStepChange={setGridStep}
      onToggleObjectSnap={() => setObjectSnapEnabled(!objectSnapEnabled)}
      onZoomOut={() => zoomAtCenter(zoom / 1.25)}
      onZoomIn={() => zoomAtCenter(zoom * 1.25)}
      onZoomReset={() => zoomAtCenter(1.0)}
      onFitView={fitView}
      bottomStyle={controlsBottomStyle}
      docked={!isMobile}
    />
  );

  return (
    <div className="flex flex-col w-full h-full bg-canvas overflow-hidden select-none">
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 bg-canvas overflow-hidden"
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu(null);
          if (activeTool !== 'select' || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const worldPt = canvasToWorld(mousePx.x, mousePx.y, pan, zoom);
          const hitId = findObjectBodyHit(objects, worldPt, zoom);
          if (!hitId) return;
          if (!selectedObjectIds.includes(hitId)) setSelectedObjectIds([hitId]);
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="w-full h-full cursor-crosshair block"
          style={{ touchAction: 'none' }}
        />

        {ctxMenu && (
          <ShapeContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} />
        )}

        {/* Стартовая подсказка на пустом чертеже — исчезает сразу после выбора инструмента или первой фигуры */}
        {objects.length === 0 && activeTool === 'select' && dragMode === 'none' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <div className="pointer-events-auto bg-surface/92 backdrop-blur-md border border-line rounded-xl px-5 py-4 shadow-md max-w-sm w-full text-center space-y-3">
              <div>
                <div className="text-sm font-semibold text-fg">Чистый лист готов к работе</div>
                <p className="text-xs text-muted mt-0.5 leading-snug">
                  Начните рисовать деталь или загрузите готовый файл DXF / SVG
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTool('line')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-fg hover:opacity-90 text-xs font-semibold transition-opacity whitespace-nowrap cursor-pointer"
                >
                  <LineDotRightHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Линия</span>
                </button>
                {isRailMachine(machine) ? (
                  <button
                    type="button"
                    onClick={() => setActiveTool('point')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-line text-fg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <CircleDot className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span>Отверстие</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTool('rectangle')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-line text-fg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span>Прямоугольник</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShapeDialog({ kind: 'import' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-line text-fg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileUp className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span>Импорт DXF/SVG</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <CanvasHud
          activeTool={activeTool}
          arcMode={arcMode}
          lineMode={lineMode}
          polyPtsCount={polyPts.length}
          drawStartPt={drawStartPt}
          drawArcStartPt={drawArcStartPt}
          drawArcEndPt={drawArcEndPt}
          measureStartPt={measureStartPt}
          measureEndPt={measureEndPt}
          lineLengthInput={lineLengthInput}
          dynAnchorPx={dynAnchorPx}
          filletFirstLineActive={Boolean(filletFirstPick)}
          filletRadius={filletRadius}
          toolStatusHint={toolStatusHint}
          onCancelDraw={() => {
            if (activeTool === 'fillet' && filletFirstPick) {
              setFilletFirstPick(null);
              filletPreviewRef.current = null;
              setHintIfChanged(null);
              scheduleDraw();
              return;
            }
            cancelDrawing();
            if (activeTool === 'trim' || activeTool === 'fillet') {
              setActiveTool('select');
            }
          }}
          onCommitPolyline={commitPolyline}
          isMobile={isMobile}
          onLineLengthChange={setLineLengthInput}
          onDynCommit={commitDynLength}
          modeSelector={
            activeTool === 'arc' ? (
              <ArcModeSelector
                value={arcMode}
                onChange={(mode) => {
                  setDrawArcStartPt(null);
                  setDrawArcEndPt(null);
                  setLineLengthInput('');
                  setArcMode(mode);
                }}
              />
            ) : activeTool === 'line' ? (
              <LineModeSelector
                value={lineMode}
                onChange={(mode) => {
                  setDrawStartPt(null);
                  setPolyPts([]);
                  setLineLengthInput('');
                  setLineMode(mode);
                }}
              />
            ) : activeTool === 'fillet' ? (
              <FilletModeSelector value={filletRadius} onChange={setFilletRadius} />
            ) : undefined
          }
        />

        {isMobile && controlsEl}
      </div>

      {!isMobile && controlsEl}
    </div>
  );
};

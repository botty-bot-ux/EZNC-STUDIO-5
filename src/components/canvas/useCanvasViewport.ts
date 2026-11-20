import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { CanvasFocusRequest, MachineSettings, Point2D } from '../../types';

interface UseCanvasViewportParams {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  machine: MachineSettings;
  canvasFocusRequest: CanvasFocusRequest | null;
  canvasFitSeq: number;
}

/**
 * Управляет камерой 2D-холста: pan/zoom, авто-подгонкой рабочей зоны (fitView),
 * фокусировкой на объекте/границах, масштабированием колесом (non-passive wheel)
 * и отслеживанием ресайза контейнера.
 */
export function useCanvasViewport({
  containerRef,
  canvasRef,
  machine,
  canvasFocusRequest,
  canvasFitSeq,
}: UseCanvasViewportParams) {
  const [pan, setPan] = useState<Point2D>({ x: 350, y: 350 });
  const [zoom, setZoom] = useState<number>(1.2);
  const [viewportVer, setViewportVer] = useState(0);

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  const machineRef = useRef(machine);
  machineRef.current = machine;

  // Перерисовка/ресайз канваса при изменении размера окна или контейнера
  useEffect(() => {
    const onResize = () => setViewportVer((v) => v + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const el = containerRef.current;
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(onResize) : null;
    if (ro && el) ro.observe(el);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      ro?.disconnect();
    };
  }, [containerRef]);

  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const m = machineRef.current;

    const offX = m.workOffset?.x ?? 0;
    const offY = m.workOffset?.y ?? 0;
    const minX = Math.min(m.bounds.xMin, m.bounds.xMax) - offX;
    const maxX = Math.max(m.bounds.xMin, m.bounds.xMax) - offX;
    const minY = Math.min(m.bounds.yMin, m.bounds.yMax) - offY;
    const maxY = Math.max(m.bounds.yMin, m.bounds.yMax) - offY;

    const boundW = Math.abs(maxY - minY) || 1000;
    const boundH = Math.abs(maxX - minX) || 1000;

    const padding = 130;
    const zoomX = (width - padding) / boundW;
    const zoomY = (height - padding) / boundH;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.2), 3.0);

    const worldCenterX = (minX + maxX) / 2;
    const worldCenterY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: width / 2 - worldCenterY * newZoom,
      y: height / 2 - worldCenterX * newZoom,
    });
  }, [containerRef]);

  // Первичный fit при монтировании
  useEffect(() => {
    fitView();
  }, [fitView]);

  // Внешний запрос «Вписать рабочую зону»
  useEffect(() => {
    if (canvasFitSeq > 0) fitView();
  }, [canvasFitSeq, fitView]);

  // Центрирование 2D-холста по запросу (двойной клик в списке, «Найти» в проверке или G-код)
  useEffect(() => {
    if (!canvasFocusRequest || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width <= 0 || height <= 0) return;

    const spanX = Math.max(Math.abs(canvasFocusRequest.maxX - canvasFocusRequest.minX), 120);
    const spanY = Math.max(Math.abs(canvasFocusRequest.maxY - canvasFocusRequest.minY), 120);
    const padding = 180;
    const zoomX = Math.max(width - padding, 120) / spanY;
    const zoomY = Math.max(height - padding, 120) / spanX;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.2), 4.5);

    const cx = (canvasFocusRequest.minX + canvasFocusRequest.maxX) / 2;
    const cy = (canvasFocusRequest.minY + canvasFocusRequest.maxY) / 2;
    setZoom(newZoom);
    setPan({
      x: width / 2 - cy * newZoom,
      y: height / 2 - cx * newZoom,
    });
  }, [canvasFocusRequest, containerRef]);

  const zoomAtCenter = useCallback(
    (targetZoom: number) => {
      if (!containerRef.current) return;
      const cx = containerRef.current.clientWidth / 2;
      const cy = containerRef.current.clientHeight / 2;
      const curZoom = zoomRef.current;
      const clamped = Math.min(Math.max(targetZoom, 0.1), 15.0);
      setPan((prev) => ({
        x: cx - (cx - prev.x) * (clamped / curZoom),
        y: cy - (cy - prev.y) * (clamped / curZoom),
      }));
      setZoom(clamped);
    },
    [containerRef]
  );

  // Не-пассивный обработчик колеса мыши: гарантирует preventDefault() при масштабировании.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      const curZoom = zoomRef.current;
      const curPan = panRef.current;
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.min(Math.max(curZoom * zoomFactor, 0.1), 15.0);

      setZoom(newZoom);
      setPan({
        x: mousePx.x - (mousePx.x - curPan.x) * (newZoom / curZoom),
        y: mousePx.y - (mousePx.y - curPan.y) * (newZoom / curZoom),
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef]);

  return {
    pan,
    setPan,
    zoom,
    setZoom,
    viewportVer,
    fitView,
    zoomAtCenter,
  };
}

import React, { RefObject, useRef } from 'react';
import { Point2D } from '../../types';
import { CanvasPointer } from './sceneCanvas.types';

interface UseCanvasGesturesParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  pan: Point2D;
  zoom: number;
  setPan: React.Dispatch<React.SetStateAction<Point2D>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onPointerDown: (e: CanvasPointer) => void;
  onPointerMove: (e: CanvasPointer) => void;
  onPointerUp: (e: CanvasPointer) => void;
  onCancelInteraction: () => void;
  onTouchPointerCleared: () => void;
}

/**
 * Единый адаптер мыши и тач-жестов для 2D-холста:
 * 1 палец = курсор (тап/драг), 2 пальца = щипок-зум + панорама,
 * плюс фильтрация синтетических mouse-событий браузера после тача.
 */
export function useCanvasGestures({
  canvasRef,
  pan,
  zoom,
  setPan,
  setZoom,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onCancelInteraction,
  onTouchPointerCleared,
}: UseCanvasGesturesParams) {
  const touchModeRef = useRef<'none' | 'single' | 'pinch'>('none');
  const lastTouchTsRef = useRef(0);
  const pinchRef = useRef<{
    startDist: number;
    startMid: Point2D;
    startZoom: number;
    startPan: Point2D;
  } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouchTsRef.current = Date.now();
    if (e.touches.length >= 2) {
      touchModeRef.current = 'pinch';
      onCancelInteraction();
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
      onPointerDown({
        clientX: t.clientX,
        clientY: t.clientY,
        shiftKey: false,
        ctrlKey: false,
        button: 0,
      });
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
      onPointerMove({ clientX: t.clientX, clientY: t.clientY, shiftKey: false, ctrlKey: false });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouchTsRef.current = Date.now();
    if (touchModeRef.current === 'pinch') {
      if (e.touches.length === 0) {
        touchModeRef.current = 'none';
        pinchRef.current = null;
      }
      return;
    }
    if (touchModeRef.current === 'single' && e.touches.length === 0) {
      touchModeRef.current = 'none';
      const t = e.changedTouches[0];
      if (t) {
        onPointerUp({ clientX: t.clientX, clientY: t.clientY, shiftKey: false, ctrlKey: false });
      }
      onTouchPointerCleared();
    }
  };

  // Браузер после тапа генерирует синтетические mouse-события — глушим их,
  // чтобы каждый жест не выполнился дважды.
  const touchedRecently = () => Date.now() - lastTouchTsRef.current < 1500;

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (touchedRecently()) return;
    if (e.button === 2) return;
    onPointerDown(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (touchedRecently()) return;
    onPointerMove(e);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (touchedRecently()) return;
    onPointerUp(e);
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

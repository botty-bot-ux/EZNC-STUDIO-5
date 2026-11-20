import { useCallback, useEffect, useRef, useState } from 'react';
import { Point2D, UnderlayState } from '../../types';
import { getUnderlayCanvasRect, UNDERLAY_HANDLE_PX } from './canvasDrawers';

type UnderlayDragState =
  | { mode: 'move'; startWorld: Point2D; origX: number; origY: number }
  | {
      mode: 'resize';
      startWorld: Point2D;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    };

/**
 * Управляет фоновой картинкой-подложкой на 2D-холсте: загрузка Image и
 * перетаскивание / изменение размера за угловую ручку.
 */
export function useCanvasUnderlay(
  underlay: UnderlayState,
  updateUnderlay: (partial: Partial<UnderlayState>) => void
) {
  const underlayImgRef = useRef<HTMLImageElement | null>(null);
  const [underlayImgVer, setUnderlayImgVer] = useState(0);
  const dragRef = useRef<UnderlayDragState | null>(null);

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

  const tryStartDrag = useCallback(
    (mousePx: Point2D, rawWorldPt: Point2D, pan: Point2D, zoom: number): boolean => {
      if (!underlay.src || !underlay.visible || underlay.frozen) return false;
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
        dragRef.current = {
          mode: 'resize',
          startWorld: rawWorldPt,
          origX: underlay.x,
          origY: underlay.y,
          origW: underlay.w,
          origH: underlay.h,
        };
        return true;
      }

      if (
        mousePx.x >= uRect.x &&
        mousePx.x <= uRect.x + uRect.w &&
        mousePx.y >= uRect.y &&
        mousePx.y <= uRect.y + uRect.h
      ) {
        dragRef.current = {
          mode: 'move',
          startWorld: rawWorldPt,
          origX: underlay.x,
          origY: underlay.y,
        };
        return true;
      }

      return false;
    },
    [underlay]
  );

  const handleMove = useCallback(
    (rawWorldPt: Point2D): boolean => {
      const uDrag = dragRef.current;
      if (!uDrag) return false;
      if (uDrag.mode === 'move') {
        const dx = rawWorldPt.x - uDrag.startWorld.x;
        const dy = rawWorldPt.y - uDrag.startWorld.y;
        updateUnderlay({ x: uDrag.origX + dx, y: uDrag.origY + dy });
      } else {
        const w = Math.max(1, rawWorldPt.x - uDrag.origX);
        const h = Math.max(1, rawWorldPt.y - uDrag.origY);
        updateUnderlay({ w, h });
      }
      return true;
    },
    [updateUnderlay]
  );

  const handleUp = useCallback((): boolean => {
    if (!dragRef.current) return false;
    dragRef.current = null;
    return true;
  }, []);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  return {
    underlayImgRef,
    underlayImgVer,
    tryStartDrag,
    handleMove,
    handleUp,
    cancelDrag,
  };
}

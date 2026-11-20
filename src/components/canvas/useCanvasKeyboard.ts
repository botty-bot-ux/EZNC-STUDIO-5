import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';
import { ActiveTool, LineMode, Point2D } from '../../types';

export interface CanvasDrawStateSnapshot {
  activeTool: ActiveTool;
  lineMode: LineMode;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  polyPts: Point2D[];
  lineLengthInput: string;
}

interface UseCanvasKeyboardParams {
  drawStateRef: MutableRefObject<CanvasDrawStateSnapshot>;
  selectedObjectIds: string[];
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedObjectId: (id: string | null) => void;
  setSelectedObjectIds: (ids: string[]) => void;
  deleteSelectedObjects: () => void;
  copySelectedObjects: () => void;
  pasteClipboard: () => void;
  setLineLengthInput: Dispatch<SetStateAction<string>>;
  setPolyPts: Dispatch<SetStateAction<Point2D[]>>;
  commitDynLengthRef: MutableRefObject<() => void>;
  commitPolylineRef: MutableRefObject<() => void>;
  cancelDrawingRef: MutableRefObject<() => void>;
  fitView: () => void;
}

/**
 * Горячие клавиши 2D-холста в фазе перехвата (capture=true):
 * Ctrl+C/V, цифровой DYN-ввод длины, Enter/Esc для полилинии и переключение инструментов.
 */
export function useCanvasKeyboard({
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
}: UseCanvasKeyboardParams): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        ((e.target as HTMLElement)?.isContentEditable ?? false);

      if (isInput) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          cancelDrawingRef.current();
          setActiveTool('select');
          e.stopPropagation();
        }
        return;
      }

      const key = e.key.toLowerCase();
      const code = e.code;

      // Групповое копирование / вставка выделенных фигур (Ctrl+C / Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && code === 'KeyC') {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          copySelectedObjects();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && code === 'KeyV') {
        e.preventDefault();
        e.stopPropagation();
        pasteClipboard();
        return;
      }

      // Dynamic distance input while a line / arc chord's first point is placed
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
          e.stopPropagation();
          setLineLengthInput((prev) => (prev + (isDecimal ? '.' : e.key)).slice(0, 12));
          return;
        }
        if (e.key === 'Backspace' && ds.lineLengthInput.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setLineLengthInput((prev) => prev.slice(0, -1));
          return;
        }
        if (e.key === 'Enter' && parseFloat(ds.lineLengthInput) > 0) {
          e.preventDefault();
          e.stopPropagation();
          commitDynLengthRef.current();
          return;
        }
        if (e.key === 'Escape' && ds.lineLengthInput.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setLineLengthInput('');
          return;
        }
      }

      // Полилиния / контур: Enter — завершить, Escape — сбросить узлы
      if (ds.activeTool === 'line' && ds.lineMode !== 'line') {
        if (e.key === 'Enter' && ds.polyPts.length >= 2) {
          e.preventDefault();
          e.stopPropagation();
          commitPolylineRef.current();
          return;
        }
        if (e.key === 'Escape' && ds.polyPts.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setPolyPts([]);
          return;
        }
      }

      if (e.key === 'Escape') {
        e.stopPropagation();
        cancelDrawingRef.current();
        setActiveTool('select');
        setSelectedObjectId(null);
        setSelectedObjectIds([]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          deleteSelectedObjects();
        }
      } else if (!e.ctrlKey && !e.metaKey) {
        if (code === 'KeyS' || key === 's' || key === 'ы') setActiveTool('select');
        else if (code === 'KeyH' || key === 'h' || key === 'р') setActiveTool('point');
        else if (code === 'KeyL' || key === 'l' || key === 'д') setActiveTool('line');
        else if (code === 'KeyR' || key === 'r' || key === 'к') setActiveTool('rectangle');
        else if (code === 'KeyC' || key === 'c' || key === 'с') setActiveTool('circle');
        else if (code === 'KeyA' || key === 'a' || key === 'ф') setActiveTool('arc');
        else if (code === 'KeyM' || key === 'm' || key === 'ь') setActiveTool('measure');
        else if (code === 'KeyT' || key === 't' || key === 'е') setActiveTool('trim');
        else if (code === 'KeyG' || key === 'g' || key === 'п') setActiveTool('fillet');
        else if (code === 'KeyF' || key === 'f' || key === 'а') fitView();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
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
  ]);
}

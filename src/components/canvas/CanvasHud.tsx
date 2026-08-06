import React from 'react';
import { ActiveTool, Point2D } from '../../types';
import { DragMode } from './canvasHitTest';

interface CanvasHudProps {
  activeTool: ActiveTool;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  dragMode: DragMode;
  dragTargetObj: any;
  currentMouseProgPt: Point2D | null;
  selectedObject: any;
  onCancelDraw: () => void;
}

export const CanvasHud: React.FC<CanvasHudProps> = ({
  activeTool,
  drawStartPt,
  drawArcStartPt,
  drawArcEndPt,
  dragMode,
  dragTargetObj,
  currentMouseProgPt,
  selectedObject,
  onCancelDraw,
}) => {
  // HUD banner for active tool instruction
  const getToolInstruction = () => {
    if (activeTool === 'line') {
      return drawStartPt
        ? 'Укажите конечную точку линии (Точка 2) или ESC для отмены'
        : 'Укажите начальную точку линии (Точка 1)';
    }
    if (activeTool === 'rectangle') {
      return drawStartPt
        ? 'Укажите противоположный угол прямоугольника'
        : 'Укажите первый угол прямоугольника';
    }
    if (activeTool === 'circle') {
      return drawStartPt ? 'Укажите точку на окружности (радиус)' : 'Укажите центр окружности';
    }
    if (activeTool === 'arc') {
      if (!drawArcStartPt) return 'Укажите начальную точку дуги (Точка 1)';
      if (!drawArcEndPt) return 'Укажите конечную точку дуги (Точка 2)';
      return 'Укажите 3-ю точку на дуге для задания радиуса и выпуклости';
    }
    if (activeTool === 'point') {
      return 'Укажите центр отверстия на рабочей плоскости';
    }
    return null;
  };

  const instruction = getToolInstruction();

  // Floating Line Drag HUD Tooltip
  let lineHud = null;
  if (
    (dragMode === 'line_start' || dragMode === 'line_end') &&
    dragTargetObj &&
    dragTargetObj.type === 'line'
  ) {
    const len = Math.hypot(
      dragTargetObj.endX - dragTargetObj.startX,
      dragTargetObj.endY - dragTargetObj.startY
    );
    const angleRad = Math.atan2(
      dragTargetObj.endY - dragTargetObj.startY,
      dragTargetObj.endX - dragTargetObj.startX
    );
    const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;

    lineHud = (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur-md text-white border border-slate-700/80 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-mono animate-in fade-in duration-150">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Длина:</span>
          <span className="font-bold text-amber-400 text-sm">{len.toFixed(2)} мм</span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Угол:</span>
          <span className="font-bold text-sky-400 text-sm">{angleDeg.toFixed(1)}°</span>
        </div>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
          <span>X1: {dragTargetObj.startX.toFixed(1)}</span>
          <span>Y1: {dragTargetObj.startY.toFixed(1)}</span>
          <span className="text-slate-500">→</span>
          <span>X2: {dragTargetObj.endX.toFixed(1)}</span>
          <span>Y2: {dragTargetObj.endY.toFixed(1)}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {lineHud}

      {/* Active tool instruction banner */}
      {instruction && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-600/90 text-white backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold animate-in fade-in duration-150">
          <span>{instruction}</span>
          <button
            onClick={onCancelDraw}
            className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-lg text-[11px] transition-colors"
          >
            ESC
          </button>
        </div>
      )}
    </>
  );
};

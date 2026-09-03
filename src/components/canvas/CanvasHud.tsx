import React from 'react';
import { ActiveTool, CADObject, Point2D } from '../../types';
import { DragMode } from './canvasHitTest';

interface CanvasHudProps {
  activeTool: ActiveTool;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  measureStartPt?: Point2D | null;
  measureEndPt?: Point2D | null;
  dragMode: DragMode;
  dragTargetObj: CADObject | null | undefined;
  currentMouseProgPt: Point2D | null;
  onCancelDraw: () => void;
}

export const CanvasHud: React.FC<CanvasHudProps> = ({
  activeTool,
  drawStartPt,
  drawArcStartPt,
  drawArcEndPt,
  measureStartPt,
  measureEndPt,
  dragMode,
  dragTargetObj,
  currentMouseProgPt,
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
    if (activeTool === 'measure') {
      if (!measureStartPt) {
        return 'Штангенциркуль: Укажите первую точку для измерения (Точка 1)';
      }
      if (!measureEndPt) {
        return 'Штангенциркуль: Укажите вторую точку для измерения (Точка 2)';
      }
      return 'Измерение зафиксировано. Нажмите в другом месте для нового замера или ESC для сброса';
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

  // Floating Caliper/Measurement HUD Overlay Panel
  let measurePanel = null;
  if (activeTool === 'measure' && measureStartPt) {
    const end = measureEndPt || currentMouseProgPt;
    if (end) {
      const dx = end.x - measureStartPt.x;
      const dy = end.y - measureStartPt.y;
      const len = Math.hypot(dx, dy);
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;

      measurePanel = (
        <div className="absolute top-4 right-4 z-30 bg-slate-900/90 backdrop-blur-2xl text-slate-100 border border-slate-700/80 p-4 rounded-2xl shadow-2xl flex flex-col gap-3.5 w-72 text-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">Штангенциркуль</span>
            </div>
            {measureEndPt ? (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                Зафиксировано
              </span>
            ) : (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                Замеряется
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Расстояние (Длина)</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-rose-400">
              {len.toFixed(3)} <span className="text-xs text-slate-500 font-normal">мм</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80 font-mono text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Проекция dX</span>
              <span className="font-bold text-slate-200">{dx >= 0 ? '+' : ''}{dx.toFixed(3)} мм</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Проекция dY</span>
              <span className="font-bold text-slate-200">{dy >= 0 ? '+' : ''}{dy.toFixed(3)} мм</span>
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/80 font-mono text-xs">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Угол наклона</span>
            <span className="font-bold text-sky-400">{angleDeg.toFixed(1)}°</span>
          </div>

          <div className="text-[10px] text-slate-400 text-center italic mt-0.5 border-t border-slate-800/40 pt-2">
            Используйте магнит O-SNAP для точной привязки к точкам чертежа.
          </div>
        </div>
      );
    }
  }

  return (
    <>
      {lineHud}
      {measurePanel}

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

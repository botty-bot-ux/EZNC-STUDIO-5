import React from 'react';
import { ActiveTool, Point2D } from '../../types';

interface CanvasHudProps {
  activeTool: ActiveTool;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  measureStartPt?: Point2D | null;
  measureEndPt?: Point2D | null;
  lineLengthInput?: string;
  onCancelDraw: () => void;
}

// Плавающие окна координат/замера перенесены в правую панель «Свойства».
// Здесь остаются только подсказка по активному инструменту и DYN-счётчик длины при наборе.
export const CanvasHud: React.FC<CanvasHudProps> = ({
  activeTool,
  drawStartPt,
  drawArcStartPt,
  drawArcEndPt,
  measureStartPt,
  measureEndPt,
  lineLengthInput,
  onCancelDraw,
}) => {
  // HUD banner for active tool instruction
  const getToolInstruction = () => {
    if (activeTool === 'line') {
      if (lineLengthInput) {
        return 'Enter — создать отрезок заданной длины · Backspace — правка · ESC — сброс';
      }
      return drawStartPt
        ? 'Введите длину с клавиатуры или укажите конечную точку (Shift = 90°/45°) · ESC — отмена'
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
      if (!drawArcEndPt) {
        if (lineLengthInput) {
          return 'Enter — зафиксировать длину хорды · Backspace — правка · ESC — сброс';
        }
        return 'Введите длину хорды или укажите конечную точку (Shift = 90°/45°) · ESC — отмена';
      }
      return 'Укажите 3-ю точку на дуге для задания радиуса и выпуклости · ESC — отмена';
    }
    if (activeTool === 'point') {
      return 'Укажите центр отверстия на рабочей плоскости';
    }
    if (activeTool === 'measure') {
      if (!measureStartPt) {
        return 'Штангенциркуль: Укажите первую точку для измерения (Точка 1)';
      }
      if (!measureEndPt) {
        return 'Штангенциркуль: Укажите вторую точку для измерения — результат в панели «Свойства»';
      }
      return 'Измерение зафиксировано. Нажмите в другом месте для нового замера или ESC для сброса';
    }
    return null;
  };

  const instruction = getToolInstruction();

  // DYN distance readout is shown while typing for the line, and for the arc's
  // start→end chord (before the endpoint is placed).
  const dynReadoutActive =
    !!lineLengthInput &&
    ((activeTool === 'line' && !!drawStartPt) ||
      (activeTool === 'arc' && !!drawArcStartPt && !drawArcEndPt));

  return (
    <>
      {/* Dynamic distance readout (DYN) while typing a line / arc-chord length */}
      {dynReadoutActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md text-white border border-amber-500/50 px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            {activeTool === 'arc' ? 'Хорда' : 'Длина'}
          </span>
          <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {lineLengthInput}
          </span>
          <span className="text-sm text-slate-400">мм</span>
          <span className="ml-1 text-[10px] text-slate-500 border border-slate-600 rounded px-1.5 py-0.5">
            Enter
          </span>
        </div>
      )}

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

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
  // Мобильный DYN-ввод: экранная клавиатура вместо физических клавиш.
  isMobile?: boolean;
  onLineLengthChange?: (v: string) => void;
  onDynCommit?: () => void;
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
  isMobile,
  onLineLengthChange,
  onDynCommit,
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

  // Мобильный режим: поле ввода длины активно, пока стоит первая точка линии/хорды дуги.
  const mobileDynActive =
    !!isMobile &&
    (activeTool === 'line'
      ? !!drawStartPt
      : activeTool === 'arc'
      ? !!drawArcStartPt && !drawArcEndPt
      : false);

  return (
    <>
      {/* Мобильный DYN-ввод длины с экранной клавиатуры */}
      {mobileDynActive && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-slate-900 dark:bg-slate-100 border border-amber-500/40 px-2 py-1.5 rounded-2xl shadow-2xl">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold ml-1">
            {activeTool === 'arc' ? 'Хорда' : 'Длина'}
          </span>
          <input
            inputMode="decimal"
            value={lineLengthInput ?? ''}
            onChange={(e) =>
              onLineLengthChange?.(
                (e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') || '').slice(0, 10)
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
                onDynCommit?.();
              }
            }}
            placeholder="0"
            className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-right font-mono text-xl font-bold text-amber-400 tabular-nums focus:outline-none focus:border-amber-500"
          />
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">мм</span>
          <button
            onClick={() => onDynCommit?.()}
            className="bg-blue-600 active:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0"
          >
            Готово
          </button>
        </div>
      )}

      {/* Dynamic distance readout (DYN) while typing a line / arc-chord length (desktop) */}
      {dynReadoutActive && !isMobile && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-slate-900 dark:bg-slate-100 text-white border border-amber-500/50 px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
            {activeTool === 'arc' ? 'Хорда' : 'Длина'}
          </span>
          <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {lineLengthInput}
          </span>
          <span className="text-sm text-slate-400 dark:text-slate-500">мм</span>
          <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-600 rounded px-1.5 py-0.5">
            Enter
          </span>
        </div>
      )}

      {/* Active tool instruction banner */}
      {instruction && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold ${
            isMobile ? 'top-16' : 'top-4'
          }`}
        >
          <span>{instruction}</span>
          <button
            onClick={onCancelDraw}
            className="bg-white/20 dark:bg-slate-900/20 hover:bg-white/30 hover:dark:bg-slate-800/30 px-2 py-0.5 rounded-lg text-[11px] transition-colors"
          >
            ESC
          </button>
        </div>
      )}
    </>
  );
};

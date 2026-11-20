import React from 'react';
import { activeToolLabel } from './canvasHudHelpers';
import { ActiveTool, ArcMode, LineMode, Point2D } from '../../types';

interface CanvasHudProps {
  activeTool: ActiveTool;
  arcMode?: ArcMode;
  lineMode?: LineMode;
  polyPtsCount?: number;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  measureStartPt?: Point2D | null;
  measureEndPt?: Point2D | null;
  lineLengthInput?: string;
  dynAnchorPx?: Point2D | null;
  onCancelDraw: () => void;
  onCommitPolyline?: () => void;
  isMobile?: boolean;
  onLineLengthChange?: (v: string) => void;
  onDynCommit?: () => void;
  modeSelector?: React.ReactNode;
  filletFirstLineActive?: boolean;
  filletRadius?: number;
  toolStatusHint?: string | null;
}

export const CanvasHud: React.FC<CanvasHudProps> = ({
  activeTool,
  arcMode = 'bulge',
  lineMode = 'line',
  polyPtsCount = 0,
  drawStartPt,
  drawArcStartPt,
  drawArcEndPt,
  measureStartPt,
  measureEndPt,
  lineLengthInput,
  dynAnchorPx,
  onCancelDraw,
  onCommitPolyline,
  isMobile,
  onLineLengthChange,
  onDynCommit,
  modeSelector,
  filletFirstLineActive = false,
  filletRadius = 10,
  toolStatusHint = null,
}) => {
  const getToolInstruction = () => {
    if (activeTool === 'line') {
      if (lineMode === 'polyline' || lineMode === 'polygon') {
        const closing = lineMode === 'polygon';
        if (polyPtsCount === 0) {
          return closing ? 'Укажите первый узел контура' : 'Укажите первый узел полилинии';
        }
        if (polyPtsCount === 1) {
          return 'Добавляйте узлы кликом · Enter — завершить';
        }
        return closing
          ? `Узлов: ${polyPtsCount} · клик по старту или Enter — замкнуть`
          : `Узлов: ${polyPtsCount} · Enter или 2×клик — завершить`;
      }
      if (lineLengthInput) {
        return 'Enter — построить отрезок заданной длины · Backspace — правка';
      }
      return drawStartPt
        ? 'Введите длину с клавиатуры или укажите вторую точку (Shift = 90°/45°)'
        : 'Укажите начальную точку отрезка';
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
      if (!drawArcStartPt) return 'Укажите начальную точку дуги';
      if (!drawArcEndPt) {
        if (arcMode === 'center') {
          return lineLengthInput
            ? 'Enter — задать радиус · Backspace — правка'
            : 'Укажите центр окружности (радиус = расстояние от старта)';
        }
        if (lineLengthInput) {
          return 'Enter — зафиксировать длину хорды · Backspace — правка';
        }
        if (arcMode === '3pt') {
          return 'Укажите вторую точку, лежащую на самой дуге';
        }
        return 'Укажите конец хорды (Shift = 90°/45°)';
      }
      if (arcMode === 'center') {
        return 'Ведите курсор вокруг центра для выбора конечного угла';
      }
      if (arcMode === '3pt') {
        return 'Укажите конечную точку — дуга пройдёт через все три';
      }
      return 'Задайте прогиб дуги: ближе к хорде — пологая, дальше — круглая';
    }
    if (activeTool === 'point') {
      return 'Укажите центр отверстия на рабочем поле';
    }
    if (activeTool === 'measure') {
      if (!measureStartPt) {
        return 'Штангенциркуль: укажите первую точку замера';
      }
      if (!measureEndPt) {
        return 'Укажите вторую точку — точные dX/dY отображаются в инспекторе';
      }
      return 'Замер зафиксирован · клик в другом месте для нового замера';
    }
    if (activeTool === 'trim') {
      return 'Наведите на отсекаемый участок и кликните · Обрезка линий, дуг и окружностей';
    }
    if (activeTool === 'fillet') {
      if (filletFirstLineActive) {
        return `Укажите второй непараллельный отрезок для дуги R${filletRadius} мм`;
      }
      return `Выберите первый отрезок или кликните по прямоугольнику (R${filletRadius} мм)`;
    }
    return null;
  };

  const instruction = getToolInstruction();
  const toolBadge = activeToolLabel(activeTool);

  const dynLabel =
    activeTool === 'arc' ? (arcMode === 'center' ? 'Радиус' : 'Хорда') : 'Длина';

  const dynReadoutActive =
    !!lineLengthInput &&
    ((activeTool === 'line' && !!drawStartPt) ||
      (activeTool === 'arc' && !!drawArcStartPt && !drawArcEndPt));

  const mobileDynActive =
    !!isMobile &&
    (activeTool === 'line'
      ? !!drawStartPt
      : activeTool === 'arc'
      ? !!drawArcStartPt && !drawArcEndPt
      : false);

  const dynBox = (
    <div className="pointer-events-auto flex items-center gap-1.5 bg-primary text-primary-fg border border-line px-2.5 py-1.5 rounded-xl shadow-lg">
      <span className="text-xs opacity-75 font-medium ml-0.5">{dynLabel}</span>
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
        className="w-20 bg-surface text-fg border border-line rounded-lg px-2 py-1 text-right font-mono text-base font-semibold focus:outline-none focus:border-accent"
      />
      <span className="text-xs opacity-75 shrink-0">мм</span>
      <button
        type="button"
        onClick={() => onDynCommit?.()}
        className="bg-accent text-accent-fg text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer"
      >
        Ок
      </button>
    </div>
  );

  const instructionBox = instruction ? (
    <div className="pointer-events-auto bg-surface/95 backdrop-blur-md border border-line text-fg px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 text-xs font-medium max-w-full">
      {toolBadge && (
        <span className="font-semibold text-accent shrink-0">{toolBadge}</span>
      )}
      {toolBadge && <span className="text-line-strong shrink-0">·</span>}
      <span className={`truncate ${toolStatusHint ? 'text-danger font-semibold' : ''}`}>
        {toolStatusHint || instruction}
      </span>
      {activeTool === 'line' &&
        (lineMode === 'polyline' || lineMode === 'polygon') &&
        polyPtsCount >= 2 && (
          <button
            type="button"
            onClick={() => onCommitPolyline?.()}
            className="bg-primary text-primary-fg hover:opacity-90 px-2.5 py-0.5 rounded-md text-xs font-semibold transition-opacity shrink-0 cursor-pointer"
          >
            {lineMode === 'polygon' ? 'Замкнуть' : 'Готово'}
          </button>
        )}
      <button
        type="button"
        onClick={onCancelDraw}
        title="Отменить инструмент (Esc)"
        className="bg-surface-subtle hover:bg-surface-hover border border-line text-fg-secondary px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors shrink-0 cursor-pointer"
      >
        ESC
      </button>
    </div>
  ) : null;

  // На мобильном сохраняем аккуратный центральный стек, на десктопе разносим по углам
  if (isMobile) {
    const hasTopStack = Boolean(modeSelector || instructionBox || mobileDynActive);
    return (
      <>
        {hasTopStack && (
          <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[94vw]">
            {modeSelector}
            {instructionBox}
            {mobileDynActive && dynBox}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Верхний левый угол: переключатель под-режима инструмента (Линия / Дуга) */}
      {modeSelector && (
        <div className="pointer-events-none absolute top-3 left-3 z-20 max-w-[42%]">
          {modeSelector}
        </div>
      )}

      {/* Верхний центр: компактная подсказка активного шага без вертикальной башни */}
      {instructionBox && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[min(640px,80%)]">
          {instructionBox}
        </div>
      )}

      {/* DYN-модуль длины у курсора (desktop) */}
      {dynReadoutActive && dynAnchorPx && (
        <div
          className="absolute z-30 flex items-baseline gap-1.5 bg-surface border border-line-strong rounded-lg px-2.5 py-1 shadow-md pointer-events-none"
          style={{ left: dynAnchorPx.x, top: dynAnchorPx.y, transform: 'translate(12px, -50%)' }}
        >
          <span className="text-[11px] text-muted font-medium">{dynLabel}</span>
          <span className="font-mono text-sm font-semibold text-fg">{lineLengthInput}</span>
          <span className="text-[11px] text-muted">мм</span>
        </div>
      )}
    </>
  );
};

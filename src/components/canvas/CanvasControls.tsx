import React, { useEffect, useRef } from 'react';
import { Eye, Grid3x3, Magnet, Maximize2, Minus, Plus } from 'lucide-react';
import { Point2D } from '../../types';

const GRID_STEP_PRESETS = [1, 5, 10, 50] as const;

export type CursorSubscribeFn = (listener: (pt: Point2D | null) => void) => () => void;

const CursorCoords: React.FC<{
  cursorPos?: Point2D | null;
  cursorSubscribe?: CursorSubscribeFn;
  compact?: boolean;
}> = ({ cursorPos, cursorSubscribe, compact = false }) => {
  const xRef = useRef<HTMLSpanElement>(null);
  const yRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!cursorSubscribe) return;
    return cursorSubscribe((pt) => {
      if (xRef.current) xRef.current.textContent = pt ? pt.x.toFixed(1) : '0.0';
      if (yRef.current) yRef.current.textContent = pt ? pt.y.toFixed(1) : '0.0';
    });
  }, [cursorSubscribe]);

  const widthCls = compact ? 'w-12' : 'w-14';
  return (
    <>
      <div className="flex items-center gap-1">
        <span className="text-muted font-medium">X</span>
        <span ref={xRef} className={`${widthCls} text-right font-semibold text-fg`}>
          {cursorPos ? cursorPos.x.toFixed(1) : '0.0'}
        </span>
      </div>
      <span className="text-line-strong">·</span>
      <div className="flex items-center gap-1">
        <span className="text-muted font-medium">Y</span>
        <span ref={yRef} className={`${widthCls} text-right font-semibold text-fg`}>
          {cursorPos ? cursorPos.y.toFixed(1) : '0.0'}
        </span>
      </div>
    </>
  );
};

interface CanvasControlsProps {
  cursorPos?: Point2D | null;
  cursorSubscribe?: CursorSubscribeFn;
  snapToGrid: boolean;
  objectSnapEnabled: boolean;
  showTrajectory: boolean;
  gridStep: number;
  zoom: number;
  onToggleGridSnap: () => void;
  onGridStepChange: (step: number) => void;
  onToggleObjectSnap: () => void;
  onToggleTrajectory: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFitView?: () => void;
  bottomStyle?: React.CSSProperties;
  docked?: boolean;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  cursorPos,
  cursorSubscribe,
  snapToGrid,
  objectSnapEnabled,
  showTrajectory,
  gridStep,
  zoom,
  onToggleGridSnap,
  onGridStepChange,
  onToggleObjectSnap,
  onToggleTrajectory,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitView,
  bottomStyle,
  docked = false,
}) => {
  const cycleGridStep = () => {
    const idx = GRID_STEP_PRESETS.indexOf(gridStep as (typeof GRID_STEP_PRESETS)[number]);
    const next = idx >= 0 ? GRID_STEP_PRESETS[(idx + 1) % GRID_STEP_PRESETS.length] : 1;
    onGridStepChange(next);
  };

  const zoomPct = Math.round(zoom * 100);

  // Десктоп: чистая док-строка состояния под 2D-холстом (без перекрытия чертежа)
  if (docked) {
    return (
      <div
        aria-label="Строка состояния и навигации"
        className="h-9 bg-surface border-t border-line px-3 flex items-center justify-between gap-3 text-fg select-none shrink-0 z-20 overflow-x-auto no-scrollbar"
      >
        {/* Левая группа: реальные координаты курсора */}
        <div
          title="Текущие координаты курсора на рабочем поле (X, Y в мм)"
          className="flex items-center gap-2 text-xs font-mono shrink-0"
        >
          <CursorCoords cursorPos={cursorPos} cursorSubscribe={cursorSubscribe} />
          <span className="text-[11px] text-muted font-sans">мм</span>
        </div>

        {/* Центральная группа: отображение и привязки */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleTrajectory}
            title={showTrajectory ? 'Показ траектории резки: ВКЛ' : 'Показ траектории резки: ВЫКЛ'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showTrajectory
                ? 'bg-primary text-primary-fg font-semibold'
                : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
            }`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Траектория</span>
          </button>

          <div className="w-px h-4 bg-line mx-1 shrink-0" />

          {/* Привязка к сетке + шаг */}
          <div className="flex items-center rounded-md border border-line overflow-hidden shrink-0">
            <button
              type="button"
              onClick={onToggleGridSnap}
              title={snapToGrid ? 'Привязка к сетке: ВКЛ' : 'Привязка к сетке: ВЫКЛ'}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                snapToGrid
                  ? 'bg-primary text-primary-fg font-semibold'
                  : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5 shrink-0" />
              <span>Сетка</span>
            </button>
            <button
              type="button"
              onClick={cycleGridStep}
              title="Сменить шаг сетки (1 / 5 / 10 / 50 мм)"
              className="px-2 py-1 text-[11px] font-mono font-semibold text-fg-secondary hover:text-fg bg-surface-subtle hover:bg-surface-hover border-l border-line transition-colors cursor-pointer whitespace-nowrap"
            >
              {gridStep} мм
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleObjectSnap}
            title={objectSnapEnabled ? 'Магнитная привязка к узлам O-SNAP: ВКЛ' : 'Магнитная привязка O-SNAP: ВЫКЛ'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              objectSnapEnabled
                ? 'bg-primary text-primary-fg font-semibold'
                : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
            }`}
          >
            <Magnet className="w-3.5 h-3.5 shrink-0" />
            <span>Узлы</span>
          </button>
        </div>

        {/* Правая группа: управление масштабом */}
        {(onZoomOut || onZoomIn || onFitView) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {onZoomOut && (
              <button
                type="button"
                onClick={onZoomOut}
                title="Уменьшить масштаб"
                className="p-1 rounded-md text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            )}
            {onZoomReset && (
              <button
                type="button"
                onClick={onZoomReset}
                title="Сбросить масштаб к 100% (1:1)"
                className="px-1.5 py-1 rounded-md text-[11px] font-mono font-semibold text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer min-w-[44px] text-center"
              >
                {zoomPct}%
              </button>
            )}
            {onZoomIn && (
              <button
                type="button"
                onClick={onZoomIn}
                title="Увеличить масштаб"
                className="p-1 rounded-md text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onFitView && (
              <button
                type="button"
                onClick={onFitView}
                title="Вписать рабочую зону в экран (F)"
                className="ml-0.5 p-1 rounded-md text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Мобильная раскладка: компактная плавающая плашка над панелью вкладок
  return (
    <div
      style={bottomStyle}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-surface/95 backdrop-blur-md border border-line p-1 rounded-xl shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.45)] text-fg z-20 max-w-[95vw] overflow-x-auto no-scrollbar select-none"
    >
      {/* Координаты курсора */}
      <div
        title="Текущие координаты курсора на рабочем поле (X, Y в мм)"
        className="flex items-center gap-2 px-2 py-1 bg-surface-subtle rounded-lg text-xs font-mono border border-line shrink-0"
      >
        <CursorCoords cursorPos={cursorPos} cursorSubscribe={cursorSubscribe} compact />
      </div>

      <div className="w-px h-5 bg-line mx-0.5 shrink-0" />

      <button
        type="button"
        onClick={onToggleTrajectory}
        title={showTrajectory ? 'Показ траектории резки: ВКЛ' : 'Показ траектории резки: ВЫКЛ'}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          showTrajectory
            ? 'bg-primary text-primary-fg font-semibold'
            : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
        }`}
      >
        <Eye className="w-3.5 h-3.5 shrink-0" />
      </button>

      <div className="flex items-center rounded-lg overflow-hidden shrink-0">
        <button
          type="button"
          onClick={onToggleGridSnap}
          title={snapToGrid ? 'Привязка к сетке: ВКЛ' : 'Привязка к сетке: ВЫКЛ'}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            snapToGrid
              ? 'bg-primary text-primary-fg font-semibold'
              : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
          }`}
        >
          <Grid3x3 className="w-3.5 h-3.5 shrink-0" />
        </button>
        <button
          type="button"
          onClick={cycleGridStep}
          title="Сменить шаг сетки"
          className="px-1.5 py-1.5 text-[11px] font-mono font-semibold text-fg-secondary bg-surface-subtle border-l border-line cursor-pointer"
        >
          {gridStep}мм
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleObjectSnap}
        title={objectSnapEnabled ? 'Магнитная привязка к узлам O-SNAP: ВКЛ' : 'Магнитная привязка O-SNAP: ВЫКЛ'}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
          objectSnapEnabled
            ? 'bg-primary text-primary-fg font-semibold'
            : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
        }`}
      >
        <Magnet className="w-3.5 h-3.5 shrink-0" />
      </button>

      {onFitView && (
        <>
          <div className="w-px h-5 bg-line mx-0.5 shrink-0" />
          <button
            type="button"
            onClick={onFitView}
            title="Вписать рабочую зону в экран"
            className="p-1.5 rounded-lg text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
};

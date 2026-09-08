import React from 'react';
import { Eye, Magnet, Move } from 'lucide-react';
import { Point2D } from '../../types';

interface CanvasControlsProps {
  cursorPos?: Point2D | null;
  snapToGrid: boolean;
  objectSnapEnabled: boolean;
  showTrajectory: boolean;
  onToggleGridSnap: () => void;
  onToggleObjectSnap: () => void;
  onToggleTrajectory: () => void;
  // Мобильная шторка открыта — поднимаем панель выше (inline-стиль для bottom).
  bottomStyle?: React.CSSProperties;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  cursorPos,
  snapToGrid,
  objectSnapEnabled,
  showTrajectory,
  onToggleGridSnap,
  onToggleObjectSnap,
  onToggleTrajectory,
  bottomStyle,
}) => {
  return (
    <div
      style={bottomStyle}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-2xl shadow-md text-slate-700 dark:text-slate-200 z-20 max-w-[95vw] overflow-x-auto"
    >
      {/* Координаты курсора на рабочем поле */}
      <div
        title="Текущие координаты курсора на рабочем поле (X, Y в мм)"
        className="flex items-center gap-2 px-3 py-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl text-xs font-mono font-medium text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 select-none shrink-0"
      >
        <div className="flex items-center gap-1">
          <span className="text-slate-400 dark:text-slate-500 font-semibold text-[13px]">X:</span>
          <span className="w-14 text-right font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {cursorPos ? cursorPos.x.toFixed(2) : '0.00'}
          </span>
        </div>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 dark:text-slate-500 font-semibold text-[13px]">Y:</span>
          <span className="w-14 text-right font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {cursorPos ? cursorPos.y.toFixed(2) : '0.00'}
          </span>
        </div>
        <span className="text-[12px] text-slate-400 dark:text-slate-500 font-medium ml-0.5">мм</span>
      </div>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 my-auto mx-0.5 shrink-0" />

      <button
        onClick={onToggleTrajectory}
        title={showTrajectory ? 'Траектория: ВКЛ (нажмите для скрытия)' : 'Траектория: ВЫКЛ (нажмите для показа)'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          showTrajectory
            ? 'bg-blue-600 text-white'
            : 'hover:bg-slate-100 hover:dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        <Eye className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 my-auto mx-0.5 shrink-0" />

      <button
        onClick={onToggleGridSnap}
        title={snapToGrid ? 'Привязка к сетке: ВКЛ (S)' : 'Привязка к сетке: ВЫКЛ (S)'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          snapToGrid
            ? 'bg-blue-600 text-white'
            : 'hover:bg-slate-100 hover:dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        <Move className="w-4 h-4" />
      </button>

      <button
        onClick={onToggleObjectSnap}
        title={objectSnapEnabled ? 'Магнитная привязка O-SNAP: ВКЛ' : 'Магнитная привязка O-SNAP: ВЫКЛ'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          objectSnapEnabled
            ? 'bg-amber-500 text-white'
            : 'hover:bg-slate-100 hover:dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        <Magnet className="w-4 h-4" />
      </button>
    </div>
  );
};

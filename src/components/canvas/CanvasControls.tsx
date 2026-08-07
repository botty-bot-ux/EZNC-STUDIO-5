import React from 'react';
import { Crosshair, Eye, Magnet, Maximize2, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { Point2D } from '../../types';

interface CanvasControlsProps {
  cursorPos?: Point2D | null;
  zoom: number;
  snapToGrid: boolean;
  objectSnapEnabled: boolean;
  showTrajectory: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleGridSnap: () => void;
  onToggleObjectSnap: () => void;
  onToggleTrajectory: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  cursorPos,
  zoom,
  snapToGrid,
  objectSnapEnabled,
  showTrajectory,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleGridSnap,
  onToggleObjectSnap,
  onToggleTrajectory,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/90 backdrop-blur-2xl border border-white/90 p-1.5 rounded-2xl shadow-2xl shadow-slate-900/15 text-slate-700 z-20 max-w-[95vw] overflow-x-auto">
      {/* Координаты курсора на рабочем поле */}
      <div
        title="Текущие координаты курсора на рабочем поле (X, Y в мм)"
        className="flex items-center gap-2 px-3 py-1 bg-slate-100/90 rounded-xl text-xs font-mono font-medium text-slate-700 border border-slate-200/80 select-none shrink-0"
      >
        <Crosshair className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-semibold text-[11px]">X:</span>
          <span className="w-14 text-right font-bold text-slate-800 tracking-tight">
            {cursorPos ? cursorPos.x.toFixed(2) : '0.00'}
          </span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-semibold text-[11px]">Y:</span>
          <span className="w-14 text-right font-bold text-slate-800 tracking-tight">
            {cursorPos ? cursorPos.y.toFixed(2) : '0.00'}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium ml-0.5">мм</span>
      </div>

      <div className="w-px h-5 bg-slate-200 my-auto mx-0.5 shrink-0" />

      <button
        onClick={onZoomOut}
        title="Уменьшить масштаб (-)"
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
      >
        <ZoomOut className="w-4 h-4 text-slate-600" />
      </button>

      <span className="font-mono text-xs font-bold w-12 text-center text-slate-800 select-none shrink-0">
        {Math.round(zoom * 100)}%
      </span>

      <button
        onClick={onZoomIn}
        title="Увеличить масштаб (+)"
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
      >
        <ZoomIn className="w-4 h-4 text-slate-600" />
      </button>

      <div className="w-px h-5 bg-slate-200 my-auto mx-0.5 shrink-0" />

      <button
        onClick={onFitView}
        title="Во весь экран / По центру (F)"
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 cursor-pointer shrink-0"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 my-auto mx-0.5 shrink-0" />

      <button
        onClick={onToggleTrajectory}
        title={showTrajectory ? 'Траектория: ВКЛ (нажмите для скрытия)' : 'Траектория: ВЫКЛ (нажмите для показа)'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          showTrajectory
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
            : 'hover:bg-slate-100 text-slate-600'
        }`}
      >
        <Eye className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 my-auto mx-0.5 shrink-0" />

      <button
        onClick={onToggleGridSnap}
        title={snapToGrid ? 'Привязка к сетке: ВКЛ (S)' : 'Привязка к сетке: ВЫКЛ (S)'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          snapToGrid
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
            : 'hover:bg-slate-100 text-slate-600'
        }`}
      >
        <Move className="w-4 h-4" />
      </button>

      <button
        onClick={onToggleObjectSnap}
        title={objectSnapEnabled ? 'Магнитная привязка O-SNAP: ВКЛ' : 'Магнитная привязка O-SNAP: ВЫКЛ'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          objectSnapEnabled
            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
            : 'hover:bg-slate-100 text-slate-600'
        }`}
      >
        <Magnet className="w-4 h-4" />
      </button>
    </div>
  );
};

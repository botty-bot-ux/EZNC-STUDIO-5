import React from 'react';
import { Eye, Magnet, Maximize2, Move, ZoomIn, ZoomOut } from 'lucide-react';

interface CanvasControlsProps {
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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/90 backdrop-blur-2xl border border-white/90 p-1.5 rounded-2xl shadow-2xl shadow-slate-900/15 text-slate-700 z-20">
      <button
        onClick={onZoomOut}
        title="Уменьшить масштаб (-)"
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
      >
        <ZoomOut className="w-4 h-4 text-slate-600" />
      </button>

      <span className="font-mono text-xs font-bold w-12 text-center text-slate-800 select-none">
        {Math.round(zoom * 100)}%
      </span>

      <button
        onClick={onZoomIn}
        title="Увеличить масштаб (+)"
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
      >
        <ZoomIn className="w-4 h-4 text-slate-600" />
      </button>

      <div className="w-px h-5 bg-slate-200 my-auto mx-0.5" />

      <button
        onClick={onFitView}
        title="Во весь экран / По центру (F)"
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 cursor-pointer"
      >
        <Maximize2 className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 my-auto mx-0.5" />

      <button
        onClick={onToggleTrajectory}
        title={showTrajectory ? 'Траектория: ВКЛ (нажмите для скрытия)' : 'Траектория: ВЫКЛ (нажмите для показа)'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
          showTrajectory
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
            : 'hover:bg-slate-100 text-slate-600'
        }`}
      >
        <Eye className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-slate-200 my-auto mx-0.5" />

      <button
        onClick={onToggleGridSnap}
        title={snapToGrid ? 'Привязка к сетке: ВКЛ (S)' : 'Привязка к сетке: ВЫКЛ (S)'}
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
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
        className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
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

import React from 'react';
import { Ruler } from 'lucide-react';
import { Point2D } from '../../../types';

interface MeasurePropertiesViewProps {
  liveMeasure: { start: Point2D; end: Point2D } | null;
}

export const MeasurePropertiesView: React.FC<MeasurePropertiesViewProps> = ({ liveMeasure }) => {
  const dx = liveMeasure ? liveMeasure.end.x - liveMeasure.start.x : 0;
  const dy = liveMeasure ? liveMeasure.end.y - liveMeasure.start.y : 0;
  const dist = Math.hypot(dx, dy);
  const angle = liveMeasure ? ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360 : 0;

  return (
    <div className="p-3.5 space-y-3 text-xs text-fg overflow-y-auto h-full select-none">
      <div className="flex items-center justify-between pb-2.5 border-b border-line">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm text-fg">Штангенциркуль</span>
        </div>
        <span className="font-mono text-[11px] text-muted">M · ESC</span>
      </div>

      {liveMeasure ? (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5 py-2 border-b border-line font-mono">
            <div>
              <span className="text-[11px] text-muted block font-sans">Расстояние</span>
              <span className="text-sm font-bold text-fg">{dist.toFixed(2)} мм</span>
            </div>
            <div>
              <span className="text-[11px] text-muted block font-sans">Угол</span>
              <span className="text-sm font-bold text-fg">{angle.toFixed(1)}°</span>
            </div>
            <div>
              <span className="text-[11px] text-muted block font-sans">Смещение dX</span>
              <span className="text-xs font-semibold text-fg-secondary">{dx.toFixed(2)} мм</span>
            </div>
            <div>
              <span className="text-[11px] text-muted block font-sans">Смещение dY</span>
              <span className="text-xs font-semibold text-fg-secondary">{dy.toFixed(2)} мм</span>
            </div>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Кликните вторую точку для фиксации замера или нажмите{' '}
            <span className="font-mono text-fg-secondary">ESC</span> для сброса.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted leading-relaxed">
          Укажите первую точку на рабочем поле. Привязка{' '}
          <span className="font-mono text-fg-secondary">O-SNAP</span> захватывает узлы, центры и пересечения.
        </p>
      )}
    </div>
  );
};

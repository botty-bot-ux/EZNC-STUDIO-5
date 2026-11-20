import React from 'react';
import { PolylineObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface PolylinePropertiesProps {
  obj: PolylineObject;
  onUpdate: (partial: Partial<PolylineObject>) => void;
}

export const PolylineProperties: React.FC<PolylinePropertiesProps> = ({ obj, onUpdate }) => {
  const updateVertex = (idx: number, coord: 'x' | 'y', val: number) => {
    const nextPts = obj.points.map((pt, i) => (i === idx ? { ...pt, [coord]: val } : pt));
    onUpdate({ points: nextPts });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-1.5 border-b border-line">
        <span className="text-xs text-muted font-medium">Тип геометрии</span>
        <div className="flex items-center gap-0.5 bg-surface-subtle p-0.5 rounded-lg border border-line">
          <button
            type="button"
            onClick={() => onUpdate({ closed: false })}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              !obj.closed
                ? 'bg-primary text-primary-fg font-semibold'
                : 'text-muted hover:text-fg'
            }`}
          >
            Полилиния
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ closed: true })}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              obj.closed
                ? 'bg-primary text-primary-fg font-semibold'
                : 'text-muted hover:text-fg'
            }`}
          >
            Контур
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {obj.points.map((pt, idx) => (
          <div key={idx} className="grid grid-cols-2 gap-2">
            <PropertyInput
              label={`X${idx + 1}`}
              value={pt.x}
              onChange={(x) => updateVertex(idx, 'x', x)}
              decimals={1}
              step={1}
            />
            <PropertyInput
              label={`Y${idx + 1}`}
              value={pt.y}
              onChange={(y) => updateVertex(idx, 'y', y)}
              decimals={1}
              step={1}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

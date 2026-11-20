import React from 'react';
import { DrillMode, PointHoleObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface PointPropertiesProps {
  obj: PointHoleObject;
  onUpdate: (partial: Partial<PointHoleObject>) => void;
}

export const PointProperties: React.FC<PointPropertiesProps> = ({ obj, onUpdate }) => {
  const is3mm = obj.drillMode === '3mm' || obj.drillMode === '3мм';
  const is9mm = obj.drillMode === '9mm' || obj.drillMode === '9мм';
  const currentMode = is3mm ? '3mm' : is9mm ? '9mm' : '11mm';

  const setDrillMode = (mode: DrillMode) => {
    const newDiameter = mode === '3mm' ? 3.0 : mode === '9mm' ? 9.0 : 11.0;
    onUpdate({
      drillMode: mode,
      diameter: newDiameter,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-muted font-medium shrink-0">Диаметр сверления</label>
        <div className="grid grid-cols-3 gap-0.5 bg-surface-subtle border border-line p-0.5 rounded-lg flex-1 max-w-[200px]">
          {(['11mm', '9mm', '3mm'] as const).map((m) => {
            const active = currentMode === m;
            const label = m === '11mm' ? '11 мм' : m === '9mm' ? '9 мм' : '3 мм';
            return (
              <button
                key={m}
                type="button"
                onClick={() => setDrillMode(m)}
                className={`py-1 px-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-primary-fg font-semibold'
                    : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="X, мм"
          value={obj.x}
          onChange={(x) => onUpdate({ x })}
          decimals={1}
          step={1}
        />
        <PropertyInput
          label="Y, мм"
          value={obj.y}
          onChange={(y) => onUpdate({ y })}
          decimals={1}
          step={1}
        />
      </div>
    </div>
  );
};

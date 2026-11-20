import React from 'react';
import { CircleObject } from '../../../types';
import { round3 } from '../../../lib/utils/num';
import { PropertyInput } from './PropertyInput';

interface CirclePropertiesProps {
  obj: CircleObject;
  onUpdate: (partial: Partial<CircleObject>) => void;
}

export const CircleProperties: React.FC<CirclePropertiesProps> = ({ obj, onUpdate }) => {
  return (
    <div className="space-y-3">
      {/* Диаметр и радиус — сначала */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          layout="stacked"
          label="Диаметр, мм"
          value={obj.radius * 2}
          onChange={(diameter) => onUpdate({ radius: Math.max(0.1, round3(diameter / 2)) })}
          decimals={1}
          step={1}
          fallbackValue={2}
        />
        <PropertyInput
          layout="stacked"
          label="Радиус, мм"
          value={obj.radius}
          onChange={(radius) => onUpdate({ radius: Math.max(0.1, radius) })}
          decimals={1}
          step={0.5}
          fallbackValue={1}
        />
      </div>

      {/* Координаты центра */}
      <div className="pt-2 border-t border-line space-y-1.5">
        <span className="text-[11px] text-muted font-medium block">Центр на поле</span>
        <div className="grid grid-cols-2 gap-2">
          <PropertyInput label="X" value={obj.centerX} onChange={(centerX) => onUpdate({ centerX })} decimals={1} step={1} />
          <PropertyInput label="Y" value={obj.centerY} onChange={(centerY) => onUpdate({ centerY })} decimals={1} step={1} />
        </div>
      </div>
    </div>
  );
};

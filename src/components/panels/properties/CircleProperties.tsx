import React from 'react';
import { CircleObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface CirclePropertiesProps {
  obj: CircleObject;
  onUpdate: (partial: Partial<CircleObject>) => void;
}

export const CircleProperties: React.FC<CirclePropertiesProps> = ({ obj, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput label="Центр X" value={obj.centerX} onChange={(centerX) => onUpdate({ centerX })} />
        <PropertyInput label="Центр Y" value={obj.centerY} onChange={(centerY) => onUpdate({ centerY })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Радиус R (мм)"
          value={obj.radius}
          onChange={(radius) => onUpdate({ radius })}
          step="0.5"
          className="text-emerald-700 font-bold"
          fallbackValue={1}
        />
        <PropertyInput label="Глубина Z (мм)" value={obj.depth} onChange={(depth) => onUpdate({ depth })} step="0.5" />
      </div>
    </div>
  );
};

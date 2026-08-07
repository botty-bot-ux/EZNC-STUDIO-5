import React from 'react';
import { RectangleObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface RectanglePropertiesProps {
  obj: RectangleObject;
  onUpdate: (partial: Partial<RectangleObject>) => void;
}

export const RectangleProperties: React.FC<RectanglePropertiesProps> = ({ obj, onUpdate }) => {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput label="X, мм" value={obj.x} onChange={(x) => onUpdate({ x })} />
        <PropertyInput label="Y, мм" value={obj.y} onChange={(y) => onUpdate({ y })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Ширина W, мм"
          value={obj.width}
          onChange={(width) => onUpdate({ width })}
          className="text-amber-700 font-bold"
          fallbackValue={1}
        />
        <PropertyInput
          label="Высота H, мм"
          value={obj.height}
          onChange={(height) => onUpdate({ height })}
          className="text-amber-700 font-bold"
          fallbackValue={1}
        />
      </div>
    </div>
  );
};


import React from 'react';
import { LineObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface LinePropertiesProps {
  obj: LineObject;
  onUpdate: (partial: Partial<LineObject>) => void;
}

export const LineProperties: React.FC<LinePropertiesProps> = ({ obj, onUpdate }) => {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput label="X1, мм" value={obj.startX} onChange={(startX) => onUpdate({ startX })} />
        <PropertyInput label="Y1, мм" value={obj.startY} onChange={(startY) => onUpdate({ startY })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput label="X2, мм" value={obj.endX} onChange={(endX) => onUpdate({ endX })} />
        <PropertyInput label="Y2, мм" value={obj.endY} onChange={(endY) => onUpdate({ endY })} />
      </div>
    </div>
  );
};


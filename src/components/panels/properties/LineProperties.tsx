import React from 'react';
import { LineObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface LinePropertiesProps {
  obj: LineObject;
  onUpdate: (partial: Partial<LineObject>) => void;
}

export const LineProperties: React.FC<LinePropertiesProps> = ({ obj, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput label="Начало X1" value={obj.startX} onChange={(startX) => onUpdate({ startX })} />
        <PropertyInput label="Начало Y1" value={obj.startY} onChange={(startY) => onUpdate({ startY })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput label="Конец X2" value={obj.endX} onChange={(endX) => onUpdate({ endX })} />
        <PropertyInput label="Конец Y2" value={obj.endY} onChange={(endY) => onUpdate({ endY })} />
      </div>

      <PropertyInput label="Глубина резания Z (мм)" value={obj.depth} onChange={(depth) => onUpdate({ depth })} step="0.5" />
    </div>
  );
};

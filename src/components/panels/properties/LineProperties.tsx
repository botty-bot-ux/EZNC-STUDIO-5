import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { LineObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface LinePropertiesProps {
  obj: LineObject;
  onUpdate: (partial: Partial<LineObject>) => void;
}

export const LineProperties: React.FC<LinePropertiesProps> = ({ obj, onUpdate }) => {
  const handleSwapPoints = () => {
    onUpdate({
      startX: obj.endX,
      startY: obj.endY,
      endX: obj.startX,
      endY: obj.startY,
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Точка 1 (X1, Y1) */}
      <div className="flex-1 space-y-1.5">
        <PropertyInput label="X1, мм" value={obj.startX} onChange={(startX) => onUpdate({ startX })} />
        <PropertyInput label="Y1, мм" value={obj.startY} onChange={(startY) => onUpdate({ startY })} />
      </div>

      {/* Кнопка "Поменять точки местами" */}
      <button
        type="button"
        onClick={handleSwapPoints}
        title="Поменять начальную и конечную точки местами"
        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-600 hover:text-blue-600 transition-colors shrink-0 flex items-center justify-center self-center"
      >
        <ArrowLeftRight className="w-4 h-4" />
      </button>

      {/* Точка 2 (X2, Y2) */}
      <div className="flex-1 space-y-1.5">
        <PropertyInput label="X2, мм" value={obj.endX} onChange={(endX) => onUpdate({ endX })} />
        <PropertyInput label="Y2, мм" value={obj.endY} onChange={(endY) => onUpdate({ endY })} />
      </div>
    </div>
  );
};



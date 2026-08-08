import React from 'react';
import { ArcObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface ArcPropertiesProps {
  obj: ArcObject;
  onUpdate: (partial: Partial<ArcObject>) => void;
}

export const ArcProperties: React.FC<ArcPropertiesProps> = ({ obj, onUpdate }) => {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="X1, мм"
          value={obj.startX}
          onChange={(startX) => onUpdate({ startX })}
          className="text-emerald-700"
        />
        <PropertyInput
          label="Y1, мм"
          value={obj.startY}
          onChange={(startY) => onUpdate({ startY })}
          className="text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="X2, мм"
          value={obj.endX}
          onChange={(endX) => onUpdate({ endX })}
          className="text-rose-700"
        />
        <PropertyInput
          label="Y2, мм"
          value={obj.endY}
          onChange={(endY) => onUpdate({ endY })}
          className="text-rose-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Xc, мм"
          value={obj.centerX}
          onChange={(centerX) => onUpdate({ centerX })}
          className="text-cyan-700"
        />
        <PropertyInput
          label="Yc, мм"
          value={obj.centerY}
          onChange={(centerY) => onUpdate({ centerY })}
          className="text-cyan-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="R, мм"
          value={obj.radius}
          onChange={(radius) => onUpdate({ radius: Math.max(0.1, radius) })}
          step="0.5"
          className="text-amber-700 font-bold"
          fallbackValue={1}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[11px] text-slate-500 font-medium shrink-0">Дуга:</label>
        <button
          type="button"
          onClick={() => onUpdate({ clockwise: !obj.clockwise })}
          className={`flex-1 py-1 px-2 rounded-lg font-semibold text-xs border transition-all flex items-center justify-center gap-1 shadow-xs ${
            obj.clockwise
              ? 'bg-cyan-50 border-cyan-300 text-cyan-800 hover:bg-cyan-100'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <span>{obj.clockwise ? '↻ G02 (по час.)' : '↺ G03 (против)'}</span>
        </button>
      </div>
    </div>
  );
};


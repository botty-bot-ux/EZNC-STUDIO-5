import React from 'react';
import { ArcObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface ArcPropertiesProps {
  obj: ArcObject;
  onUpdate: (partial: Partial<ArcObject>) => void;
}

export const ArcProperties: React.FC<ArcPropertiesProps> = ({ obj, onUpdate }) => {
  return (
    <div className="space-y-2.5">
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
          label="Центр Xc, мм"
          value={obj.centerX}
          onChange={(centerX) => onUpdate({ centerX })}
          className="text-cyan-700"
        />
        <PropertyInput
          label="Центр Yc, мм"
          value={obj.centerY}
          onChange={(centerY) => onUpdate({ centerY })}
          className="text-cyan-700"
        />
      </div>

      <div>
        <PropertyInput
          label="Радиус R, мм"
          value={obj.radius}
          onChange={(radius) => onUpdate({ radius: Math.max(0.1, radius) })}
          step="0.5"
          className="text-amber-700 font-bold"
          fallbackValue={1}
        />
      </div>

      <div>
        <label className="text-[11px] text-slate-400 block mb-1 font-medium">Направление дуги</label>
        <button
          type="button"
          onClick={() => onUpdate({ clockwise: !obj.clockwise })}
          className={`w-full py-1.5 px-3 rounded-lg font-semibold text-xs border transition-all flex items-center justify-center gap-1.5 shadow-sm ${
            obj.clockwise
              ? 'bg-cyan-50 border-cyan-300 text-cyan-800 hover:bg-cyan-100'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <span>{obj.clockwise ? '↻ По часовой (G02)' : '↺ Против часовой (G03)'}</span>
        </button>
      </div>
    </div>
  );
};


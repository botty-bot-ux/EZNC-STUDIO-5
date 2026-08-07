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
    <div className="space-y-2.5">
      {/* 3 Buttons for Drill Mode */}
      <div>
        <label className="text-[11px] text-slate-400 block mb-1 font-medium">Режим сверления</label>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setDrillMode('11mm')}
            className={`py-1 px-2 text-xs font-semibold rounded-lg transition-all ${
              currentMode === '11mm'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            11 мм
          </button>
          <button
            type="button"
            onClick={() => setDrillMode('9mm')}
            className={`py-1 px-2 text-xs font-semibold rounded-lg transition-all ${
              currentMode === '9mm'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            9 мм
          </button>
          <button
            type="button"
            onClick={() => setDrillMode('3mm')}
            className={`py-1 px-2 text-xs font-semibold rounded-lg transition-all ${
              currentMode === '3mm'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            3 мм
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="X, мм"
          value={obj.x}
          onChange={(x) => onUpdate({ x })}
        />
        <PropertyInput
          label="Y, мм"
          value={obj.y}
          onChange={(y) => onUpdate({ y })}
        />
      </div>
    </div>
  );
};


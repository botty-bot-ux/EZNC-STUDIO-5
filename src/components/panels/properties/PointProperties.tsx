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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Координата X (мм)"
          value={obj.x}
          onChange={(x) => onUpdate({ x })}
        />
        <PropertyInput
          label="Координата Y (мм)"
          value={obj.y}
          onChange={(y) => onUpdate({ y })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Диаметр (мм)"
          value={obj.diameter}
          onChange={(diameter) => onUpdate({ diameter })}
          step="0.5"
          className="text-purple-700 font-bold"
          fallbackValue={1}
        />
        <PropertyInput
          label="Глубина Z (мм)"
          value={obj.depth}
          onChange={(depth) => onUpdate({ depth })}
          step="0.5"
        />
      </div>

      <div>
        <label className="text-slate-500 block mb-1 font-medium">Режим сверления</label>
        <select
          value={is3mm ? '3mm' : is9mm ? '9mm' : '11mm'}
          onChange={(e) => {
            const mode = e.target.value as DrillMode;
            const newDiameter = mode === '3mm' ? 3.0 : mode === '9mm' ? 9.0 : 11.0;
            onUpdate({
              drillMode: mode,
              diameter: newDiameter,
            });
          }}
          className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-semibold focus:border-purple-500 focus:bg-white focus:outline-none transition-all"
        >
          <option value="11mm">11мм (Спиральное сверление 11мм - 2 прохода)</option>
          <option value="9mm">9мм (Спиральное сверление 9мм - 1 проход)</option>
          <option value="3mm">3мм (Точка в ДСП на глубину)</option>
        </select>
      </div>

      {/* Template Info Card */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-900 space-y-1 shadow-sm">
        <span className="font-bold text-purple-800 block">
          {is3mm
            ? 'Шаблон сверления 3мм:'
            : is9mm
            ? 'Шаблон сверления 9мм:'
            : 'Шаблон сверления 11мм:'}
        </span>
        <pre className="font-mono text-[10px] text-purple-800 bg-white/80 p-2 rounded-lg border border-purple-200 leading-relaxed overflow-x-auto shadow-inner">
          {is3mm
            ? `G00 X0.0 Y0.0 Z5.0
G01 Z-${obj.depth || 5.0} F500.0
G00 Z5.0`
            : is9mm
            ? `G00 X-0.5 Y0.0 Z5.0
G02 I0.5 J0.0 Z-33.0 F1000.0
G00 Z5.0`
            : `G00 X-1.5 Y0.0 Z5.0
G02 I1.5 J0.0 Z-16.0 F1000.0
G02 I1.5 J0.0 Z-33.0
G00 Z5.0`}
        </pre>
      </div>
    </div>
  );
};

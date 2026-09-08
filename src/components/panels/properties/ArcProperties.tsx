import React from 'react';
import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import { ArcObject } from '../../../types';
import { mirrorArc } from '../../../lib/geometry/transform';
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
          className="text-emerald-700 dark:text-emerald-400"
        />
        <PropertyInput
          label="Y1, мм"
          value={obj.startY}
          onChange={(startY) => onUpdate({ startY })}
          className="text-emerald-700 dark:text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="X2, мм"
          value={obj.endX}
          onChange={(endX) => onUpdate({ endX })}
          className="text-rose-700 dark:text-rose-400"
        />
        <PropertyInput
          label="Y2, мм"
          value={obj.endY}
          onChange={(endY) => onUpdate({ endY })}
          className="text-rose-700 dark:text-rose-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Xc, мм"
          value={obj.centerX}
          onChange={(centerX) => onUpdate({ centerX })}
          className="text-cyan-700 dark:text-cyan-400"
        />
        <PropertyInput
          label="Yc, мм"
          value={obj.centerY}
          onChange={(centerY) => onUpdate({ centerY })}
          className="text-cyan-700 dark:text-cyan-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="R, мм"
          value={obj.radius}
          onChange={(radius) => onUpdate({ radius: Math.max(0.1, radius) })}
          step="0.5"
          className="text-amber-700 dark:text-amber-400 font-bold"
          fallbackValue={1}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[13px] text-slate-500 dark:text-slate-400 font-medium shrink-0">Дуга:</label>
        <button
          type="button"
          onClick={() => onUpdate({ clockwise: !obj.clockwise })}
          className={`flex-1 py-1 px-2 rounded-lg font-semibold text-xs border transition-all flex items-center justify-center gap-1 shadow-xs ${
            obj.clockwise
              ? 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-300 text-cyan-800 dark:text-cyan-400 hover:bg-cyan-100 hover:dark:bg-cyan-500/20'
              : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 hover:dark:bg-emerald-500/20'
          }`}
        >
          <span>{obj.clockwise ? '↻ G02 (по час.)' : '↺ G03 (против)'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[13px] text-slate-500 dark:text-slate-400 font-medium shrink-0">Отзеркалить:</label>
        <button
          type="button"
          onClick={() => onUpdate(mirrorArc(obj, 'h'))}
          title="Отзеркалить по горизонтали (влево↔вправо) на месте"
          className="flex-1 py-1 px-2 rounded-lg font-semibold text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 hover:border-slate-400 transition-all flex items-center justify-center gap-1.5 shadow-xs"
        >
          <FlipHorizontal2 className="w-3.5 h-3.5" />
          <span>Горизонт.</span>
        </button>
        <button
          type="button"
          onClick={() => onUpdate(mirrorArc(obj, 'v'))}
          title="Отзеркалить по вертикали (вверх↕вниз) на месте"
          className="flex-1 py-1 px-2 rounded-lg font-semibold text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 hover:border-slate-400 transition-all flex items-center justify-center gap-1.5 shadow-xs"
        >
          <FlipVertical2 className="w-3.5 h-3.5" />
          <span>Верт.</span>
        </button>
      </div>
    </div>
  );
};


import React from 'react';
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from 'lucide-react';
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
          label="X1"
          value={obj.startX}
          onChange={(startX) => onUpdate({ startX })}
          decimals={1}
          step={1}
        />
        <PropertyInput
          label="Y1"
          value={obj.startY}
          onChange={(startY) => onUpdate({ startY })}
          decimals={1}
          step={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="X2"
          value={obj.endX}
          onChange={(endX) => onUpdate({ endX })}
          decimals={1}
          step={1}
        />
        <PropertyInput
          label="Y2"
          value={obj.endY}
          onChange={(endY) => onUpdate({ endY })}
          decimals={1}
          step={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Xc"
          value={obj.centerX}
          onChange={(centerX) => onUpdate({ centerX })}
          decimals={1}
          step={1}
        />
        <PropertyInput
          label="Yc"
          value={obj.centerY}
          onChange={(centerY) => onUpdate({ centerY })}
          decimals={1}
          step={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 items-end pt-1">
        <PropertyInput
          layout="stacked"
          label="Радиус, мм"
          value={obj.radius}
          onChange={(radius) => onUpdate({ radius: Math.max(0.1, radius) })}
          decimals={1}
          step={1}
          fallbackValue={1}
        />
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={() => onUpdate({ clockwise: !obj.clockwise })}
            title={
              obj.clockwise
                ? 'По часовой стрелке (G02) — переключить на против часовой'
                : 'Против часовой стрелки (G03) — переключить на по часовой'
            }
            className={`h-8 px-2 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
              obj.clockwise
                ? 'bg-surface-subtle border-line text-fg hover:bg-surface-hover'
                : 'bg-accent/12 border-accent/40 text-accent hover:bg-accent/20'
            }`}
          >
            {obj.clockwise ? <RotateCw className="w-3.5 h-3.5 shrink-0" /> : <RotateCcw className="w-3.5 h-3.5 shrink-0" />}
            <span>{obj.clockwise ? 'По час.' : 'Против'}</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdate(mirrorArc(obj, 'h'))}
            title="Отзеркалить по горизонтали"
            className="h-8 w-8 rounded-lg border border-line bg-surface-subtle text-muted hover:text-fg hover:bg-surface-hover transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          >
            <FlipHorizontal2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate(mirrorArc(obj, 'v'))}
            title="Отзеркалить по вертикали"
            className="h-8 w-8 rounded-lg border border-line bg-surface-subtle text-muted hover:text-fg hover:bg-surface-hover transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          >
            <FlipVertical2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

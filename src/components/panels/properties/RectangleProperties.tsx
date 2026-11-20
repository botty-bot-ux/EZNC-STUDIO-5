import React from 'react';
import { RectangleObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface RectanglePropertiesProps {
  obj: RectangleObject;
  onUpdate: (partial: Partial<RectangleObject>) => void;
}

export const RectangleProperties: React.FC<RectanglePropertiesProps> = ({ obj, onUpdate }) => {
  const maxCornerRadius = Math.max(0, Math.min(obj.width, obj.height) / 2);

  return (
    <div className="space-y-3">
      {/* Сначала понятные размеры детали */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          layout="stacked"
          label="Ширина, мм"
          value={obj.width}
          onChange={(width) => onUpdate({ width: Math.max(0.1, width) })}
          decimals={1}
          step={1}
          fallbackValue={1}
        />
        <PropertyInput
          layout="stacked"
          label="Высота, мм"
          value={obj.height}
          onChange={(height) => onUpdate({ height: Math.max(0.1, height) })}
          decimals={1}
          step={1}
          fallbackValue={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 items-end">
        <PropertyInput
          layout="stacked"
          label="Скругление углов, мм"
          value={obj.cornerRadius ?? 0}
          onChange={(r) => onUpdate({ cornerRadius: Math.max(0, Math.min(maxCornerRadius, r)) })}
          decimals={1}
          step={1}
          fallbackValue={0}
        />
        <span className="font-mono tabular-nums text-[11px] text-muted pb-2">
          макс. {maxCornerRadius.toFixed(1)} мм
        </span>
      </div>

      {/* Положение угла на поле */}
      <div className="pt-2 border-t border-line space-y-1.5">
        <span className="text-[11px] text-muted font-medium block">Положение на поле</span>
        <div className="grid grid-cols-2 gap-2">
          <PropertyInput label="X" value={obj.x} onChange={(x) => onUpdate({ x })} decimals={1} step={1} />
          <PropertyInput label="Y" value={obj.y} onChange={(y) => onUpdate({ y })} decimals={1} step={1} />
        </div>
      </div>
    </div>
  );
};

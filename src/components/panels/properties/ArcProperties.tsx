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
          decimals={1}
          step={1}
          className="text-slate-800 dark:text-slate-100"
        />
        <PropertyInput
          label="Y1, мм"
          value={obj.startY}
          onChange={(startY) => onUpdate({ startY })}
          decimals={1}
          step={1}
          className="text-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="X2, мм"
          value={obj.endX}
          onChange={(endX) => onUpdate({ endX })}
          decimals={1}
          step={1}
          className="text-slate-800 dark:text-slate-100"
        />
        <PropertyInput
          label="Y2, мм"
          value={obj.endY}
          onChange={(endY) => onUpdate({ endY })}
          decimals={1}
          step={1}
          className="text-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          label="Xc, мм"
          value={obj.centerX}
          onChange={(centerX) => onUpdate({ centerX })}
          decimals={1}
          step={1}
          className="text-slate-800 dark:text-slate-100"
        />
        <PropertyInput
          label="Yc, мм"
          value={obj.centerY}
          onChange={(centerY) => onUpdate({ centerY })}
          decimals={1}
          step={1}
          className="text-slate-800 dark:text-slate-100"
        />
      </div>

      {/*
        Нижний ряд в той же сетке 2-на-2, что и координаты: слева «R, мм» — такой же
        ширины и с округлением до 1 знака (запятая), как у остальных полей; справа —
        три компактные иконочные кнопки (направление дуги, зеркало по горизонтали,
        зеркало по вертикали).
      */}
      <div className="grid grid-cols-2 gap-2 items-stretch">
        <PropertyInput
          label="R, мм"
          value={obj.radius}
          onChange={(radius) => onUpdate({ radius: Math.max(0.1, radius) })}
          decimals={1}
          step={1}
          className="text-slate-800 dark:text-slate-100 font-bold"
          fallbackValue={1}
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdate({ clockwise: !obj.clockwise })}
            title={
              obj.clockwise
                ? 'Дуга по часовой (G02) — клик переключит на против часовой (G03)'
                : 'Дуга против часовой (G03) — клик переключит на по часовой (G02)'
            }
            className={`shrink-0 w-8 rounded-lg text-base font-bold border transition-colors ${
              obj.clockwise
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200/90 dark:border-slate-700/90 text-slate-700 dark:text-slate-200 hover:bg-slate-200 hover:dark:bg-slate-700'
                : 'bg-primary/10 dark:bg-primary/20 border-primary/40 text-primary hover:bg-primary/20 hover:dark:bg-primary/30'
            }`}
          >
            {obj.clockwise ? '↻' : '↺'}
          </button>
          <button
            type="button"
            onClick={() => onUpdate(mirrorArc(obj, 'h'))}
            title="Отзеркалить по горизонтали (влево ↔ вправо) на месте"
            className="shrink-0 w-8 rounded-lg border border-slate-200/90 dark:border-slate-700/90 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 hover:dark:bg-slate-700 hover:text-primary transition-colors flex items-center justify-center"
          >
            <FlipHorizontal2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate(mirrorArc(obj, 'v'))}
            title="Отзеркалить по вертикали (вверх ↕ вниз) на месте"
            className="shrink-0 w-8 rounded-lg border border-slate-200/90 dark:border-slate-700/90 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 hover:dark:bg-slate-700 hover:text-primary transition-colors flex items-center justify-center"
          >
            <FlipVertical2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

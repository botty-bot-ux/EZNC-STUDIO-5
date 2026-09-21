import React from 'react';
import { Spline, TrendingUp, CircleDot } from 'lucide-react';
import { ArcMode } from '../../types';

interface ArcModeOption {
  id: ArcMode;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const OPTIONS: ArcModeOption[] = [
  {
    id: '3pt',
    label: '3 точки',
    hint: 'Три точки: старт → точка НА дуге → конец. Дуга проходит через все три.',
    Icon: Spline,
  },
  {
    id: 'bulge',
    label: 'Горб',
    hint: 'Хорда + высота: старт → конец, затем мышь тянет вершину прогиба (ближе к хорде — пололее).',
    Icon: TrendingUp,
  },
  {
    id: 'center',
    label: 'Центр',
    hint: 'Старт → центр → охват: радиус фиксирован, конец скользит по окружности за мышью.',
    Icon: CircleDot,
  },
];

interface ArcModeSelectorProps {
  value: ArcMode;
  onChange: (mode: ArcMode) => void;
}

/**
 * Плавающий переключатель способа построения дуги. Показывается только когда
 * активен инструмент «Дуга». Меняет под-режим (arcMode) в сторе.
 */
export const ArcModeSelector: React.FC<ArcModeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-2xl shadow-md text-slate-700 dark:text-slate-200 max-w-[95vw]">
      <span className="px-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
        Дуга:
      </span>
      {OPTIONS.map(({ id, label, hint, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            title={hint}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              active
                ? 'bg-primary text-primary-fg'
                : 'hover:bg-slate-100 hover:dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

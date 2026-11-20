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
    hint: 'Три точки: старт → точка на дуге → конец',
    Icon: Spline,
  },
  {
    id: 'bulge',
    label: 'Хорда + прогиб',
    hint: 'Старт → конец хорды, затем высота прогиба',
    Icon: TrendingUp,
  },
  {
    id: 'center',
    label: 'От центра',
    hint: 'Старт → центр окружности → угол охвата',
    Icon: CircleDot,
  },
];

interface ArcModeSelectorProps {
  value: ArcMode;
  onChange: (mode: ArcMode) => void;
}

export const ArcModeSelector: React.FC<ArcModeSelectorProps> = ({ value, onChange }) => {
  return (
    <div
      role="radiogroup"
      aria-label="Способ построения дуги"
      className="pointer-events-auto flex items-center gap-0.5 bg-surface/95 backdrop-blur-md border border-line p-1 rounded-lg shadow-sm text-fg max-w-[94vw] overflow-x-auto no-scrollbar select-none"
    >
      <span className="px-2 text-[11px] font-medium text-muted shrink-0">Дуга:</span>
      {OPTIONS.map(({ id, label, hint, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            title={hint}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              active
                ? 'bg-primary text-primary-fg font-semibold'
                : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

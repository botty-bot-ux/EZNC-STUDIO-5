import React from 'react';
import { Minus, Waypoints, Hexagon } from 'lucide-react';
import { LineMode } from '../../types';

interface LineModeOption {
  id: LineMode;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const OPTIONS: LineModeOption[] = [
  {
    id: 'line',
    label: 'Отрезок',
    hint: 'Одиночный отрезок между двумя точками',
    Icon: Minus,
  },
  {
    id: 'polyline',
    label: 'Полилиния',
    hint: 'Ломаная из нескольких звеньев (Enter — завершить)',
    Icon: Waypoints,
  },
  {
    id: 'polygon',
    label: 'Контур',
    hint: 'Замкнутая полилиния (Enter — замкнуть)',
    Icon: Hexagon,
  },
];

interface LineModeSelectorProps {
  value: LineMode;
  onChange: (mode: LineMode) => void;
}

export const LineModeSelector: React.FC<LineModeSelectorProps> = ({ value, onChange }) => {
  return (
    <div
      role="radiogroup"
      aria-label="Способ построения линии"
      className="pointer-events-auto flex items-center gap-0.5 bg-surface/95 backdrop-blur-md border border-line p-1 rounded-lg shadow-sm text-fg max-w-[94vw] overflow-x-auto no-scrollbar select-none"
    >
      <span className="px-2 text-[11px] font-medium text-muted shrink-0">Режим:</span>
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

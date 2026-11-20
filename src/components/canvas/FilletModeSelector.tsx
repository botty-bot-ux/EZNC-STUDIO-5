import React from 'react';
import { CornerUpRight } from 'lucide-react';
import { NumericInput } from '../ui/NumericInput';

interface FilletModeSelectorProps {
  value: number;
  onChange: (radius: number) => void;
}

const PRESETS = [3, 5, 10, 20, 30, 50];

export const FilletModeSelector: React.FC<FilletModeSelectorProps> = ({ value, onChange }) => {
  return (
    <div
      aria-label="Радиус скругления углов"
      className="pointer-events-auto flex items-center gap-1 bg-surface/95 backdrop-blur-md border border-line p-1 rounded-lg shadow-sm text-fg max-w-[94vw] overflow-x-auto no-scrollbar select-none"
    >
      <span className="flex items-center gap-1 px-1.5 text-[11px] font-medium text-muted shrink-0">
        <CornerUpRight className="w-3.5 h-3.5 text-accent shrink-0" />
        <span>Радиус R:</span>
      </span>

      <div className="flex items-center gap-0.5">
        {PRESETS.map((r) => {
          const active = Math.abs(value - r) < 1e-4;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onChange(r)}
              className={`px-2 py-1 rounded-md font-mono text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-primary text-primary-fg font-semibold'
                  : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-line mx-0.5 shrink-0" />

      <div className="flex items-center gap-1 pr-1 shrink-0">
        <NumericInput
          value={value}
          fallbackValue={value}
          min={0.1}
          liveMin={0.5}
          sanitize={(raw) => raw.replace(/[^0-9.,]/g, '')}
          onCommitValue={onChange}
          ariaLabel="Свой радиус скругления, мм"
          className="w-14 bg-surface-subtle border border-line rounded-md px-1.5 py-0.5 text-right font-mono text-xs font-semibold text-fg focus:outline-none focus:border-accent"
        />
        <span className="text-[11px] text-muted">мм</span>
      </div>
    </div>
  );
};

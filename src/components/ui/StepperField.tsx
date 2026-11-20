import React from 'react';
import { useScrub } from './useScrub';
import { ScrubChevrons } from './ScrubChevrons';

interface StepperFieldProps {
  label: string;
  value: string;
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
  onScrub: (deltaSteps: number) => void;
  onEnter: () => void;
}

export const StepperField: React.FC<StepperFieldProps> = ({
  label,
  value,
  inputMode = 'decimal',
  placeholder,
  autoFocus,
  onChange,
  onScrub,
  onEnter,
}) => {
  const up = useScrub(onScrub, { clickDir: 1 });
  const down = useScrub(onScrub, { clickDir: -1 });

  return (
    <label className="block">
      <span className="text-xs font-medium text-muted block mb-1">{label}</span>
      <div className="flex items-stretch gap-1">
        <input
          type="text"
          inputMode={inputMode}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
          placeholder={placeholder}
          className="w-full min-w-0 bg-surface-subtle border border-line rounded-lg px-2.5 py-1.5 font-mono text-sm font-semibold text-fg text-center focus:border-accent focus:bg-surface focus:outline-none transition-colors"
        />
        <ScrubChevrons
          up={up}
          down={down}
          variant="dialog"
          titles={{
            up: 'Больше: клик +1; зажать и тянуть вверх/вниз',
            down: 'Меньше: клик −1; зажать и тянуть вверх/вниз',
          }}
        />
      </div>
    </label>
  );
};

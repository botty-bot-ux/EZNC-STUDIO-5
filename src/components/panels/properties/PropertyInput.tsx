import React, { useId } from 'react';
import { useScrub } from '../../ui/useScrub';
import { ScrubChevrons } from '../../ui/ScrubChevrons';
import { useNumericDraft } from '../../ui/useNumericDraft';

interface PropertyInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  step?: string | number;
  className?: string;
  fallbackValue?: number;
  decimals?: number;
  layout?: 'inline' | 'stacked';
}

export const PropertyInput: React.FC<PropertyInputProps> = ({
  label,
  value,
  onChange,
  step,
  className = 'text-fg',
  fallbackValue = 0,
  decimals,
  layout = 'inline',
}) => {
  const id = useId();
  const { display, handleChange, commit, resolveBase, normalize, clearDraft } = useNumericDraft({
    value,
    fallbackValue,
    decimals,
    onCommitValue: onChange,
  });

  const stepNum = typeof step === 'string' ? parseFloat(step.replace(',', '.')) : step;
  const hasStepper = typeof stepNum === 'number' && Number.isFinite(stepNum) && stepNum > 0;

  const shift = (deltaSteps: number) => {
    if (!hasStepper) return;
    const next = normalize(resolveBase() + deltaSteps * (stepNum as number));
    clearDraft();
    onChange(next);
  };

  const up = useScrub(shift, { clickDir: 1 });
  const down = useScrub(shift, { clickDir: -1 });

  const inputEl = (
    <div className="flex items-stretch flex-1 min-w-0">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`w-full min-w-0 bg-surface-subtle border border-line ${
          hasStepper ? 'rounded-l-lg rounded-r-none border-r-0' : 'rounded-lg'
        } px-2.5 py-1.5 text-xs font-mono tabular-nums font-semibold focus:bg-surface focus:border-accent focus:outline-none transition-colors ${className}`}
      />
      {hasStepper && (
        <ScrubChevrons
          up={up}
          down={down}
          variant="field"
          titles={{
            up: 'Увеличить: клик +1 шаг; зажать и тянуть вверх/вниз',
            down: 'Уменьшить: клик −1 шаг; зажать и тянуть вверх/вниз',
          }}
        />
      )}
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div className="w-full min-w-0">
        <label
          htmlFor={id}
          className="text-[11px] text-muted font-medium block mb-1 truncate"
          title={label}
        >
          {label}
        </label>
        {inputEl}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 w-full">
      <label
        htmlFor={id}
        className="text-xs text-muted font-mono font-medium whitespace-nowrap shrink-0 min-w-[34px]"
        title={label}
      >
        {label}
      </label>
      {inputEl}
    </div>
  );
};

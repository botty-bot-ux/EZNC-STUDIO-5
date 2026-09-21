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
  /**
   * Реакция на стрелки: `deltaSteps` — целое число шагов (положительное вверх,
   * отрицательное вниз). Клик = ±1; зажать-и-тянуть = сколько шагов прошли по вертикали
   * (6 px = 1 шаг, направление не зависит от того, на какой стрелке начали).
   */
  onScrub: (deltaSteps: number) => void;
  onEnter: () => void;
}

/**
 * Числовое поле с вертикальными стрелками ▲/▼ для ввода мышкой.
 * Стрелки поддерживают и обычный клик (±1 шаг), и «зажать и тянуть» — тогда
 * значение меняется плавно, пока не отпустишь кнопку мыши.
 */
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
      <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="mt-1 flex items-stretch gap-1">
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
          className="w-full min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-center focus:border-primary focus:bg-white focus:dark:bg-slate-900 focus:outline-none transition-all"
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

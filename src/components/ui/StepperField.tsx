import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface StepperFieldProps {
  label: string;
  value: string;
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
  /** dir = +1 (▲) или −1 (▼). */
  onStep: (dir: 1 | -1) => void;
  onEnter: () => void;
}

/** Числовое поле с вертикальными стрелками ▲/▼ для ввода мышкой. */
export const StepperField: React.FC<StepperFieldProps> = ({
  label,
  value,
  inputMode = 'decimal',
  placeholder,
  autoFocus,
  onChange,
  onStep,
  onEnter,
}) => (
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
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onStep(1)}
          title="Больше"
          className="flex-1 px-1.5 rounded-t-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 hover:dark:bg-slate-700 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onStep(-1)}
          title="Меньше"
          className="flex-1 px-1.5 rounded-b-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 border-t-0 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 hover:dark:bg-slate-700 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </label>
);

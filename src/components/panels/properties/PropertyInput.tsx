import React from 'react';

interface PropertyInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  step?: string | number;
  className?: string;
  fallbackValue?: number;
}

export const PropertyInput: React.FC<PropertyInputProps> = ({
  label,
  value,
  onChange,
  step = '1',
  className = 'text-slate-800 dark:text-slate-100',
  fallbackValue = 0,
}) => {
  return (
    <div className="flex items-center gap-1.5 w-full">
      <label
        className="text-[13px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap shrink-0 min-w-[32px]"
        title={label}
      >
        {label}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || fallbackValue)}
        className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2 py-1 text-xs font-mono focus:bg-white focus:dark:bg-slate-800 focus:border-blue-500 focus:outline-none transition-all ${className}`}
      />
    </div>
  );
};


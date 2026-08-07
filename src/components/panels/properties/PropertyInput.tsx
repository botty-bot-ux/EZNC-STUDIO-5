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
  className = 'text-slate-800',
  fallbackValue = 0,
}) => {
  return (
    <div>
      <label className="text-[11px] text-slate-400 block mb-0.5 font-medium truncate" title={label}>
        {label}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || fallbackValue)}
        className={`w-full bg-slate-50 border border-slate-200/90 rounded-lg px-2 py-1 text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition-all ${className}`}
      />
    </div>
  );
};

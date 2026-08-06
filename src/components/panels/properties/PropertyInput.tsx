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
      <label className="text-slate-500 block mb-1 font-medium">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || fallbackValue)}
        className={`w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition-all ${className}`}
      />
    </div>
  );
};

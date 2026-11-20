import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

/** Компактный переключатель (switch) для инспектора и панелей настроек. */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}) => (
  <label
    className={`relative inline-flex items-center shrink-0 ${
      disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only peer"
    />
    <div className="w-8 h-4.5 bg-line-strong rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-1 peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-3.5 after:w-3.5 after:transition-transform peer-checked:after:translate-x-3.5" />
  </label>
);

import React from 'react';
import { useNumericDraft, UseNumericDraftOptions } from './useNumericDraft';

export interface NumericInputProps extends UseNumericDraftOptions {
  id?: string;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Унифицированное числовое поле с поддержкой локальной запятой, черновика
 * при вводе и фиксацией по Enter / потере фокуса.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  id,
  className,
  ariaLabel,
  placeholder,
  disabled,
  ...draftOptions
}) => {
  const { display, handleChange, commit } = useNumericDraft(draftOptions);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={display}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
};

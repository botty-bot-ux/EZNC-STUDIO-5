import React, { useState } from 'react';

interface PropertyInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  /** Сохраняется в интерфейсе ради совместимости вызовов; для текстового поля не используется. */
  step?: string | number;
  className?: string;
  fallbackValue?: number;
  /** Если задано — значение округляется до этого числа знаков после запятой при уходе из поля. */
  decimals?: number;
}

/** Строка → число (запятая как разделитель); не число/пусто → null. */
function toNumber(raw: string): number | null {
  const v = parseFloat(raw.replace(',', '.').trim());
  return Number.isFinite(v) ? v : null;
}

export const PropertyInput: React.FC<PropertyInputProps> = ({
  label,
  value,
  onChange,
  className = 'text-slate-800 dark:text-slate-100',
  fallbackValue = 0,
  decimals,
}) => {
  // Локальный черновик: даёт набирать дробь/запятую, не «съедая» ввод. Вне редактирования
  // показываем значение из props (при заданном decimals — округлённым до нужного числа знаков).
  const [draft, setDraft] = useState<string | null>(null);

  // Вне редактирования показываем значение из props: при decimals — округлённое и с запятой
  // как десятичным разделителем (привычнее для русскоязычного интерфейса).
  const display =
    draft !== null
      ? draft
      : decimals != null
        ? Number(value).toFixed(decimals).replace('.', ',')
        : String(value);

  const handleChange = (raw: string) => {
    setDraft(raw);
    const n = toNumber(raw);
    if (n !== null) onChange(n); // живое обновление холста/G-кода без округления
  };

  const commit = () => {
    if (draft !== null) {
      const n = toNumber(draft);
      let next = n !== null ? n : fallbackValue;
      if (decimals != null) next = Number(next.toFixed(decimals));
      onChange(next);
    }
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-1.5 w-full">
      <label
        className="text-[13px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap shrink-0 min-w-[32px]"
        title={label}
      >
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2 py-1 text-xs font-mono focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all ${className}`}
      />
    </div>
  );
};

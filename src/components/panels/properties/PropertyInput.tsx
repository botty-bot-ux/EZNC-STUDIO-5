import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useScrub } from '../../ui/useScrub';

interface PropertyInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  /**
   * Если задано положительным числом — справа появляются стрелки ▲/▼, каждая
   * из которых меняет значение на ±step. По умолчанию шаг = 1 мм, то есть
   * меняются цифры ДО запятой. Зажать стрелку и вести мышь вверх/вниз —
   * значение меняется непрерывно (6 px = 1 шаг).
   */
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
  step,
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

  // Шаг для стрелок: принимаем и число, и строку («1», «0.5»); невалидное или <=0 → стрелок нет.
  const stepNum = typeof step === 'string' ? parseFloat(step.replace(',', '.')) : step;
  const hasStepper = typeof stepNum === 'number' && Number.isFinite(stepNum) && stepNum > 0;

  // Общая функция сдвига на `deltaSteps` шагов (клик = ±1; drag = накопленное число шагов).
  // Считаем от актуального черновика, если он есть, иначе от props.value.
  const shift = (deltaSteps: number) => {
    if (!hasStepper) return;
    const base = draft !== null ? toNumber(draft) ?? value : value;
    let next = base + deltaSteps * (stepNum as number);
    if (decimals != null) next = Number(next.toFixed(decimals));
    setDraft(null);
    onChange(next);
  };

  // Хуки нельзя вызывать условно — вешаем всегда, а внутри shift есть guard по hasStepper.
  const up = useScrub(shift, { clickDir: 1 });
  const down = useScrub(shift, { clickDir: -1 });

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
        className={`w-full min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/90 ${hasStepper ? 'rounded-l-lg rounded-r-none border-r-0' : 'rounded-lg'} px-2 py-1 text-xs font-mono focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all ${className}`}
      />
      {hasStepper && (
        <div className="flex flex-col shrink-0 self-stretch">
          <button
            type="button"
            tabIndex={-1}
            {...up}
            title="Больше: клик +1 мм; зажать и тянуть вверх/вниз"
            className="flex-1 px-1 rounded-r-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/90 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 hover:dark:bg-slate-700 active:bg-slate-200 active:dark:bg-slate-700 transition-colors cursor-ns-resize"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            {...down}
            title="Меньше: клик −1 мм; зажать и тянуть вверх/вниз"
            className="flex-1 px-1 rounded-r-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/90 border-t-0 dark:border-t-0 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 hover:dark:bg-slate-700 active:bg-slate-200 active:dark:bg-slate-700 transition-colors cursor-ns-resize"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

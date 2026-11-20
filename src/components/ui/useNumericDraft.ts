import { useState } from 'react';
import { parseDecimalOrNull } from '../../lib/utils/num';

export interface UseNumericDraftOptions {
  value: number;
  fallbackValue?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  decimals?: number;
  onCommitValue: (val: number) => void;
  /** Минимальное значение для мгновенного live-коммита при вводе (если не задано — коммитит любое валидное число). */
  liveMin?: number;
  /** Фильтр допустимых символов при вводе (например, только цифры и разделитель). */
  sanitize?: (raw: string) => string;
}

export function normalizeNumericValue(
  raw: number,
  opts: Pick<UseNumericDraftOptions, 'min' | 'max' | 'integer' | 'decimals'>
): number {
  let n = opts.integer ? Math.round(raw) : raw;
  if (opts.min !== undefined) n = Math.max(opts.min, n);
  if (opts.max !== undefined) n = Math.min(opts.max, n);
  if (typeof opts.decimals === 'number' && Number.isFinite(opts.decimals)) {
    const dec = Math.max(0, Math.min(100, Math.trunc(opts.decimals)));
    n = Number(n.toFixed(dec));
  }
  return n;
}

export function formatNumericDisplay(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return '';
  if (typeof decimals === 'number' && Number.isFinite(decimals)) {
    const dec = Math.max(0, Math.min(100, Math.trunc(decimals)));
    return value.toFixed(dec).replace('.', ',');
  }
  return String(value);
}

/**
 * Общий хук редактирования числовых полей с поддержкой запятой/точки,
 * чернового состояния (draft), нормализации диапазона и фиксации на blur/Enter.
 */
export function useNumericDraft({
  value,
  fallbackValue = 0,
  min,
  max,
  integer,
  decimals,
  onCommitValue,
  liveMin,
  sanitize,
}: UseNumericDraftOptions) {
  const [draft, setDraft] = useState<string | null>(null);

  const display = draft !== null ? draft : formatNumericDisplay(value, decimals);

  const normalize = (raw: number) =>
    normalizeNumericValue(raw, { min, max, integer, decimals });

  const resolveBase = (): number => {
    if (draft === null) return value;
    const parsed = parseDecimalOrNull(draft);
    return parsed !== null ? parsed : fallbackValue;
  };

  const handleChange = (rawInput: string) => {
    const raw = sanitize ? sanitize(rawInput) : rawInput;
    setDraft(raw);
    const parsed = parseDecimalOrNull(raw);
    if (parsed !== null) {
      if (liveMin === undefined || parsed >= liveMin) {
        onCommitValue(normalize(parsed));
      }
    }
  };

  const commit = () => {
    if (draft !== null) {
      const parsed = parseDecimalOrNull(draft);
      onCommitValue(normalize(parsed !== null ? parsed : fallbackValue));
      setDraft(null);
    }
  };

  const clearDraft = () => setDraft(null);

  return {
    display,
    draft,
    handleChange,
    commit,
    resolveBase,
    normalize,
    clearDraft,
  };
}

import { describe, expect, it } from 'vitest';
import { parseDecimal, parseDecimalOrNull } from './num';
import { formatNumericDisplay, normalizeNumericValue } from '../../components/ui/useNumericDraft';

describe('numeric input utilities', () => {
  it('parses decimal strings with dot or comma and rejects invalid input', () => {
    expect(parseDecimalOrNull('12.5')).toBe(12.5);
    expect(parseDecimalOrNull(' 12,5 ')).toBe(12.5);
    expect(parseDecimalOrNull('-3,25')).toBe(-3.25);
    expect(parseDecimalOrNull('')).toBeNull();
    expect(parseDecimalOrNull('abc')).toBeNull();
    expect(parseDecimal('abc', 42)).toBe(42);
  });

  it('normalizes min, max, integer, and decimals constraints', () => {
    expect(normalizeNumericValue(12.7, { integer: true })).toBe(13);
    expect(normalizeNumericValue(-5, { min: 0, max: 100 })).toBe(0);
    expect(normalizeNumericValue(250, { min: 0, max: 100 })).toBe(100);
    expect(normalizeNumericValue(1.23456, { decimals: 2 })).toBe(1.23);
  });

  it('formats numeric display strings with optional comma decimals', () => {
    expect(formatNumericDisplay(12.5)).toBe('12.5');
    expect(formatNumericDisplay(12.5, 1)).toBe('12,5');
    expect(formatNumericDisplay(Number.NaN, 1)).toBe('');
  });
});

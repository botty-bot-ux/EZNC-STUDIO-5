/**
 * Разбор десятичного ввода (запятая ИЛИ точка как разделитель).
 * Общая утилитa: поля свойств (PropertyInput) и диалоги (Переместить,
 * Параллельная …) раньше имели по копии одной и той же функции.
 */

/** Строка → число; не число/пусто → null. */
export function parseDecimalOrNull(raw: string): number | null {
  const v = parseFloat(raw.replace(',', '.').trim());
  return Number.isFinite(v) ? v : null;
}

/** Строка → число; не число/пусто → fallback (по умолчанию 0). */
export function parseDecimal(raw: string, fallback = 0): number {
  return parseDecimalOrNull(raw) ?? fallback;
}

let idCounter = 0;

/**
 * Генерирует уникальный идентификатор CAD-объекта.
 * Монотонный счётчик гарантирует отсутствие коллизий даже при пакетном
 * создании сотен фигур в пределах одной миллисекунды.
 */
export function createObjectId(tag?: string): string {
  idCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const seq = idCounter.toString(36);
  return tag ? `obj_${ts}_${tag}_${seq}_${rand}` : `obj_${ts}_${seq}_${rand}`;
}

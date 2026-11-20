/** Стандартные размеры листа ДСП (шаблоны раскроя), общие для инспектора и мастера нового проекта. */
export const STOCK_WIDTH_OPTIONS = [881, 981, 1281, 1481, 1681, 1881, 2081];
export const STOCK_HEIGHT_OPTIONS = [250, 360, 1081, 1121, 1201];
export const STOCK_HEIGHT_LABELS: Record<number, string> = {
  250: 'парящая',
  360: 'царга',
};

/** Типовые размеры рабочего стола ЧПУ (ширина Y × глубина X в мм). */
export const BED_SIZE_PRESETS: Array<{ label: string; widthY: number; heightX: number }> = [
  { label: '2000 × 1600', widthY: 2000, heightX: 1600 },
  { label: '2500 × 1300', widthY: 2500, heightX: 1300 },
  { label: '3000 × 2000', widthY: 3000, heightX: 2000 },
];

/** Возвращает отсортированный список пресетов с включением текущего нестандартного значения. */
export function withCurrentOption(current: number, baseOptions: number[]): number[] {
  if (baseOptions.includes(current)) return baseOptions;
  return [current, ...baseOptions].sort((a, b) => a - b);
}

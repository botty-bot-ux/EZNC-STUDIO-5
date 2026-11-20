// Палитра холста (2D-контекст рисует свои цвета, согласованные с CSS-переменными темы).

export interface CanvasPalette {
  /** Фон рабочей области. */
  bg: string;
  /** Прозрачный и плотный варианты фона для градиентного затухания по краям. */
  bgFade0: string;
  bgFade1: string;
  /** Линии сетки: мелкая и крупная. */
  gridMinor: string;
  gridMajor: string;
  /** Плашка под подписями (мм, оси). */
  labelChip: string;
  /** Рамка плашки (0,0). */
  chipBorder: string;
  /** Текст подписей. */
  labelText: string;
  /** Текст «сильных» подписей (названия, длины). */
  labelTextStrong: string;
  /** Штрих неактивной CAD-фигуры. */
  objectIdle: string;
  /** Фон бейджа измерения. */
  measureBadgeBg: string;
  /** Акцент выделения (рамка/синька). */
  accentBlue: string;
}

export const LIGHT_PALETTE: CanvasPalette = {
  bg: '#f3f4f6',
  bgFade0: 'rgba(243, 244, 246, 0)',
  bgFade1: 'rgba(243, 244, 246, 1)',
  gridMinor: '#dde1e7',
  gridMajor: '#bfc6d1',
  labelChip: 'rgba(255, 255, 255, 0.94)',
  chipBorder: '#d1d5db',
  labelText: '#4b5563',
  labelTextStrong: '#111827',
  objectIdle: '#111827',
  measureBadgeBg: '#111827',
  accentBlue: '#2563eb',
};

export const DARK_PALETTE: CanvasPalette = {
  bg: '#0b0e14',
  bgFade0: 'rgba(11, 14, 20, 0)',
  bgFade1: 'rgba(11, 14, 20, 1)',
  gridMinor: '#171d29',
  gridMajor: '#263042',
  labelChip: 'rgba(18, 22, 31, 0.94)',
  chipBorder: '#263042',
  labelText: '#8b95a5',
  labelTextStrong: '#f3f4f6',
  objectIdle: '#e5e7eb',
  measureBadgeBg: '#0b0e14',
  accentBlue: '#3b82f6',
};

export function paletteForTheme(theme: 'light' | 'dark'): CanvasPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

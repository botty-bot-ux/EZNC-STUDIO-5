// Палитра холста (2D-контекст рисует свои цвета, а не Tailwind-классы).
// Разные роли переключаются вместе с темой приложения; акцентные цвета
// (синий/красный/зелёный/циан/пурпур для траекторий и ручек) общие для обеих тем.

export interface CanvasPalette {
  /** Фон рабочей области. */
  bg: string;
  /** Прозрачный и плотный варианты фона для градиентного затухания по краям. */
  bgFade0: string;
  bgFade1: string;
  /** Линии сетки: мелкая и крупная. */
  gridMinor: string;
  gridMajor: string;
  /** Пунктирная рамка границ станка. */
  frameLine: string;
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
  bg: '#f8fafc',
  bgFade0: 'rgba(248, 250, 252, 0)',
  bgFade1: 'rgba(248, 250, 252, 1)',
  gridMinor: '#cbd5e1',
  gridMajor: '#94a3b8',
  frameLine: '#64748b',
  labelChip: 'rgba(255, 255, 255, 0.92)',
  chipBorder: '#cbd5e1',
  labelText: '#475569',
  labelTextStrong: '#1e293b',
  objectIdle: '#0f172a',
  measureBadgeBg: '#0f172a',
  accentBlue: '#2563eb',
};

export const DARK_PALETTE: CanvasPalette = {
  bg: '#0f172a',
  bgFade0: 'rgba(15, 23, 42, 0)',
  bgFade1: 'rgba(15, 23, 42, 1)',
  gridMinor: '#1e293b',
  gridMajor: '#334155',
  frameLine: '#64748b',
  labelChip: 'rgba(30, 41, 59, 0.92)',
  chipBorder: '#334155',
  labelText: '#94a3b8',
  labelTextStrong: '#e2e8f0',
  objectIdle: '#e2e8f0',
  measureBadgeBg: '#020617',
  accentBlue: '#60a5fa',
};

export function paletteForTheme(theme: 'light' | 'dark'): CanvasPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

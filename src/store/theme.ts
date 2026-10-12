export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'cnc_theme';

// Тема — вне проекта (не попадает в экспорт/автосейв). Читаем сохранённую, иначе — системную.
export function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === 'dark' || t === 'light') return t;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // ignore
  }
  return 'light';
}

export function applyThemeClass(theme: Theme) {
  try {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {
    // ignore
  }
}

export function writeStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

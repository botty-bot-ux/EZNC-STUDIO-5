import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface HotkeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string;
  desc: string;
}

const GROUPS: Array<{ title: string; items: ShortcutItem[] }> = [
  {
    title: 'Инструменты черчения',
    items: [
      { keys: 'S', desc: 'Выбор и перетаскивание' },
      { keys: 'L', desc: 'Линия / полилиния / контур' },
      { keys: 'R', desc: 'Прямоугольник' },
      { keys: 'C', desc: 'Окружность' },
      { keys: 'A', desc: 'Дуга (режим «Изголовье»)' },
      { keys: 'H', desc: 'Отверстие (режим «Царга»)' },
      { keys: 'T', desc: 'Ножницы (обрезка по пересечениям)' },
      { keys: 'G', desc: 'Скругление углов линий и прямоугольников' },
      { keys: 'M', desc: 'Штангенциркуль (замер)' },
    ],
  },
  {
    title: 'Точность и навигация',
    items: [
      { keys: '0–9, Enter', desc: 'Ввод длины / радиуса при черчении (DYN)' },
      { keys: 'Shift', desc: 'Фиксация угла 90° / 45°' },
      { keys: 'Колесо', desc: 'Масштаб относительно курсора' },
      { keys: 'F', desc: 'Вписать рабочую зону в экран' },
      { keys: 'СКМ / ПКМ', desc: 'Панорама холста (на пустом месте)' },
      { keys: '2×клик', desc: 'Приблизить к фигуре в списке слоёв' },
    ],
  },
  {
    title: 'Редактирование и файлы',
    items: [
      { keys: 'Ctrl + Z / Y', desc: 'Отменить / повторить действие' },
      { keys: 'Ctrl + C / V', desc: 'Копировать / вставить со смещением' },
      { keys: 'ПКМ по фигуре', desc: 'Меню: Зеркало, 90°, Массив, Сдвиг' },
      { keys: 'Del / Backspace', desc: 'Удалить выбранные объекты' },
      { keys: 'Esc', desc: 'Отмена построения / инструмент «Выбор»' },
      { keys: 'Перетаскивание', desc: 'Бросьте .json, .nc, .dxf или .svg в окно' },
    ],
  },
];

export const HotkeysModal: React.FC<HotkeysModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Горячие клавиши и управление"
        className="bg-surface border border-line rounded-xl max-w-xl w-full p-5 shadow-xl space-y-4 text-fg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-fg">Горячие клавиши и приёмы работы</h3>
          </div>

          <button
            onClick={onClose}
            title="Закрыть (Esc)"
            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <div className="text-xs font-semibold text-muted">
                {group.title}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.keys + item.desc}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-line/60"
                  >
                    <span className="text-xs text-fg-secondary leading-snug">{item.desc}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-surface border border-line font-mono text-[11px] font-semibold text-fg shrink-0">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

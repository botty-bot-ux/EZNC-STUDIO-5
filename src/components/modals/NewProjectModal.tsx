import React, { useEffect } from 'react';
import { CircleDot, FilePlus, Spline, X } from 'lucide-react';
import { ProjectMode } from '../../store/initialState';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasObjects: boolean;
  onCreate: (mode: ProjectMode) => void;
}

// Создание проекта: перед очисткой выбираем режим детали —
// «Изголовье» (узор фрезой Ø3) или «Царга» (рез и сверловка фрезой Ø8).
export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  hasObjects,
  onCreate,
}) => {
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

  const options: Array<{
    mode: ProjectMode;
    title: string;
    subtitle: string;
    Icon: React.ElementType;
    iconClass: string;
  }> = [
    {
      mode: 'head',
      title: 'Изголовье',
      subtitle: 'Фреза Ø3 мм · лист 1681×1081 · узор (линии и дуги)',
      Icon: Spline,
      iconClass: 'bg-slate-100 text-accent dark:bg-slate-800 dark:text-accent',
    },
    {
      mode: 'rail',
      title: 'Царга',
      subtitle: 'Фреза Ø8 мм · лист 2080×360 · рез и отверстия',
      Icon: CircleDot,
      iconClass: 'bg-slate-100 text-accent dark:bg-slate-800 dark:text-accent',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-100/40 flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full p-5 shadow-lg space-y-4 text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-fg">
              <FilePlus className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Новый проект</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasObjects && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Текущий проект будет очищен — вернуть можно через Ctrl+Z.
          </p>
        )}

        {/* Режим детали */}
        <div className="grid gap-2">
          {options.map(({ mode, title, subtitle, Icon, iconClass }) => (
            <button
              key={mode}
              onClick={() => onCreate(mode)}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:bg-slate-50 hover:dark:bg-slate-800 active:bg-slate-100 active:dark:bg-slate-700 transition-all text-left cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{title}</div>
                <div className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScrubHandlers } from './useScrub';

interface ScrubChevronsProps {
  /** Пропсы «зажать и тянуть» для ▲ (useScrub с clickDir: 1). */
  up: ScrubHandlers;
  /** Пропсы для ▼ (useScrub с clickDir: -1). */
  down: ScrubHandlers;
  /** 'field' — колонка впритык к полю свойств; 'dialog' — степпер в диалогах. */
  variant: 'field' | 'dialog';
  titles: { up: string; down: string };
}

/**
 * Колонка кнопок ▲/▼ поверх useScrub. Единственное место, где живёт эта разметка:
 * раньше PropertyInput и StepperField носили по своей копии (отличались только
 * отступы/скругления — эти отличия сохранены посимвольно через вариант).
 */
export const ScrubChevrons: React.FC<ScrubChevronsProps> = ({ up, down, variant, titles }) => {
  const wrap =
    variant === 'field' ? 'flex flex-col shrink-0 self-stretch' : 'flex flex-col shrink-0';

  const hover =
    'text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 hover:dark:bg-slate-700 active:bg-slate-200 active:dark:bg-slate-700 transition-colors cursor-ns-resize';

  const btn =
    variant === 'field'
      ? {
          up: `flex-1 px-1 rounded-r-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/90 ${hover}`,
          down: `flex-1 px-1 rounded-r-lg bg-slate-100 dark:bg-slate-800 border border-t-0 dark:border-t-0 border-slate-200/90 dark:border-slate-700/90 ${hover}`,
        }
      : {
          up: `flex-1 px-1.5 rounded-t-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${hover}`,
          down: `flex-1 px-1.5 rounded-b-lg bg-slate-100 dark:bg-slate-800 border border-t-0 dark:border-t-0 border-slate-200 dark:border-slate-700 ${hover}`,
        };

  return (
    <div className={wrap}>
      <button type="button" tabIndex={-1} {...up} title={titles.up} className={btn.up}>
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button type="button" tabIndex={-1} {...down} title={titles.down} className={btn.down}>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

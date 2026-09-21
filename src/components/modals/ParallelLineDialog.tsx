import React, { useEffect, useState } from 'react';
import { GitCompareArrows, X } from 'lucide-react';

interface ParallelLineDialogProps {
  isOpen: boolean;
  /** Название исходной линии — для заголовка. */
  sourceName: string;
  onClose: () => void;
  /** Применяет создание параллельной линии со смещением distance мм по нормали. */
  onCreate: (distance: number) => void;
}

/** Ввод → число мм: запятая как разделитель, пусто/нечисло → 0. */
function parseMM(raw: string): number {
  const v = parseFloat(raw.replace(',', '.').trim());
  return Number.isFinite(v) ? v : 0;
}

/**
 * Модуль построения параллельной линии: пользователь задаёт расстояние (мм) от исходной
 * линии. Знак задаёт сторону смещения. «Подтвердить»/Enter создаёт линию, «Отмена»/Escape — закрывает.
 */
export const ParallelLineDialog: React.FC<ParallelLineDialogProps> = ({
  isOpen,
  sourceName,
  onClose,
  onCreate,
}) => {
  const [distStr, setDistStr] = useState('16');

  useEffect(() => {
    if (isOpen) setDistStr('16');
  }, [isOpen]);

  if (!isOpen) return null;

  const distance = parseMM(distStr);
  const canApply = distance !== 0;

  const confirm = () => {
    if (!canApply) return;
    onCreate(distance);
    onClose();
  };

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-72 select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Параллельная линия"
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-lg text-slate-800 dark:text-slate-100"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">Параллельная линия</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors"
            title="Отмена"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
            Расстояние от линии, мм
          </span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={distStr}
            onChange={(e) => setDistStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
              }
            }}
            placeholder="16"
            className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-center focus:border-primary focus:bg-white focus:dark:bg-slate-900 focus:outline-none transition-all"
          />
        </label>
        <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
          Исходная: {sourceName}. Знак «−» смещает линию на другую сторону.
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-800 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={!canApply}
            className="px-5 py-2 rounded-xl text-xs font-bold text-primary-fg bg-primary hover:opacity-90 active:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
          >
            ОК
          </button>
        </div>
      </div>
    </div>
  );
}

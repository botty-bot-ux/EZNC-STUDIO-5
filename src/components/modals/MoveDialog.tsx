import React, { useEffect, useState } from 'react';
import { Move, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

interface MoveDialogProps {
  isOpen: boolean;
  /** id перемещаемых фигур (уже без замороженных) — для живого превью на холсте. */
  ids: string[];
  onClose: () => void;
  onApply: (dx: number, dy: number) => void;
}

/** Ввод → число мм: запятая как разделитель, пусто/нечисло → 0. */
function parseMM(raw: string): number {
  const v = parseFloat(raw.replace(',', '.').trim());
  return Number.isFinite(v) ? v : 0;
}

/**
 * Минималистичный модуль перемещения. Пока пользователь вводит X/Y, выбранная группа
 * в реальном времени сдвигается на холсте (store.liveMove — только превью). «Подтвердить»
 * применяет смещение, «Отмена»/Escape/клик мимо — откатывает (превью сбрасывается).
 */
export const MoveDialog: React.FC<MoveDialogProps> = ({ isOpen, ids, onClose, onApply }) => {
  const setLiveMove = useProjectStore((s) => s.setLiveMove);
  const [xStr, setXStr] = useState('');
  const [yStr, setYStr] = useState('');

  // Открыли — чистим поля и превью; закрыли — гарантированно снимаем превью.
  useEffect(() => {
    if (isOpen) {
      setXStr('');
      setYStr('');
      setLiveMove(null);
    } else {
      setLiveMove(null);
    }
  }, [isOpen, setLiveMove]);

  if (!isOpen) return null;

  const dx = parseMM(xStr);
  const dy = parseMM(yStr);
  const canApply = ids.length > 0 && (dx !== 0 || dy !== 0);

  const changeX = (v: string) => {
    setXStr(v);
    setLiveMove({ ids, dx: parseMM(v), dy: parseMM(yStr) });
  };
  const changeY = (v: string) => {
    setYStr(v);
    setLiveMove({ ids, dx: parseMM(xStr), dy: parseMM(v) });
  };

  const cancel = () => {
    setLiveMove(null);
    onClose();
  };
  const confirm = () => {
    if (!canApply) return;
    setLiveMove(null);
    onApply(dx, dy);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/30 dark:bg-slate-100/30 flex items-center justify-center p-4 select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          cancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl w-full max-w-xs p-5 shadow-lg text-slate-800 dark:text-slate-100"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-semibold text-sm">Переместить</h3>
            {ids.length > 1 && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">· {ids.length} фигур</span>
            )}
          </div>
          <button
            onClick={cancel}
            className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors"
            title="Отмена"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">X, мм</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={xStr}
              onChange={(e) => changeX(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirm();
                }
              }}
              placeholder="0"
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-center focus:border-sky-500 focus:bg-white focus:dark:bg-slate-900 focus:outline-none transition-all"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Y, мм</span>
            <input
              type="text"
              inputMode="decimal"
              value={yStr}
              onChange={(e) => changeY(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirm();
                }
              }}
              placeholder="0"
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-center focus:border-sky-500 focus:bg-white focus:dark:bg-slate-900 focus:outline-none transition-all"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={cancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-800 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={!canApply}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
};

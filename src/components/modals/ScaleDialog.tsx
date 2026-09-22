import React, { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { parseDecimal as parseNum } from '../../lib/utils/num';
import { Point2D } from '../../types';
import { StepperField } from '../ui/StepperField';

type ScaleAxis = 'both' | 'x' | 'y';

interface ScaleDialogProps {
  isOpen: boolean;
  /** id масштабируемых фигур (уже без замороженных) — для живого превью на холсте. */
  ids: string[];
  /** Якорь растяжения (мир, мм) — обычно центр рамки выделения. */
  anchor: Point2D;
  onClose: () => void;
  onApply: (anchor: Point2D, sx: number, sy: number) => void;
}

const AXES: { id: ScaleAxis; label: string }[] = [
  { id: 'both', label: 'Обе' },
  { id: 'x', label: 'Горизонталь' },
  { id: 'y', label: 'Вертикаль' },
];

/**
 * Минималистичный модуль масштабирования (растяжения). Пользователь выбирает ось —
 * горизонталь (X), вертикаль (Y) или обе — и задаёт множитель в процентах
 * (120 = ×1.2, 50 = ×0.5, отрицательное значение отражает фигуру относительно якоря).
 * Пока вводится значение, выбранная группа в реальном времени растягивается на холсте
 * (store.liveScale — только превью). «Подтвердить» применяет, «Отмена»/Escape — откатывает.
 */
export const ScaleDialog: React.FC<ScaleDialogProps> = ({ isOpen, ids, anchor, onClose, onApply }) => {
  const setLiveScale = useProjectStore((s) => s.setLiveScale);
  const [axis, setAxis] = useState<ScaleAxis>('both');
  const [pctStr, setPctStr] = useState('');

  // Открыли — чистим поля и превью; закрыли — гарантированно снимаем превью.
  useEffect(() => {
    if (isOpen) {
      setAxis('both');
      setPctStr('');
      setLiveScale(null);
    } else {
      setLiveScale(null);
    }
  }, [isOpen, setLiveScale]);

  if (!isOpen) return null;

  const factors = (pct: number): { sx: number; sy: number } => {
    const s = pct / 100;
    return { sx: axis === 'y' ? 1 : s, sy: axis === 'x' ? 1 : s };
  };
  const { sx, sy } = factors(parseNum(pctStr));
  const canApply = ids.length > 0 && pctStr.trim() !== '' && (sx !== 1 || sy !== 1);

  const changePct = (v: string) => {
    setPctStr(v);
    const f = factors(parseNum(v));
    setLiveScale({ ids, anchor, ...f });
  };

  // Шаг стрелками: клик = ±10 %; «зажать и тянуть» = сколько шагов прошли по вертикали.
  const scrub = (delta: number) => changePct(String(parseNum(pctStr) + delta * 10));

  const cancel = () => {
    setLiveScale(null);
    onClose();
  };
  const confirm = () => {
    if (!canApply) return;
    setLiveScale(null);
    onApply(anchor, sx, sy);
    onClose();
  };

  const changeAxis = (a: ScaleAxis) => {
    setAxis(a);
    if (pctStr.trim() !== '') {
      setLiveScale({ ids, anchor, ...factors(parseNum(pctStr)) });
    } else {
      setLiveScale(null);
    }
  };

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-72 select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          cancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Масштабировать"
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-lg text-slate-800 dark:text-slate-100"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">Масштабировать</h3>
            {ids.length > 1 && (
              <span className="text-[13px] text-slate-400 dark:text-slate-500">· {ids.length} фигур</span>
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

        {/* Выбор оси растяжения */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          {AXES.map((a) => (
            <button
              key={a.id}
              onClick={() => changeAxis(a.id)}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                axis === a.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 hover:dark:text-slate-200'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <StepperField
            label="Масштаб, %"
            value={pctStr}
            inputMode="decimal"
            autoFocus
            placeholder="100"
            onChange={changePct}
            onScrub={scrub}
            onEnter={confirm}
          />
          <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            {axis === 'x'
              ? 'Растяжение по горизонтали (X) относительно центра выделения.'
              : axis === 'y'
              ? 'Растяжение по вертикали (Y) относительно центра выделения.'
              : 'Равномерное растяжение по обеим осям относительно центра выделения.'}{' '}
            120 — увеличить в 1,2 раза; «−» отразит фигуру. Окружности и дуги
            растягиваются без изменения формы (радиус — как средний масштаб).
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={cancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-800 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={!canApply}
            className="px-5 py-2 rounded-xl text-xs font-bold text-primary-fg bg-primary hover:opacity-90 active:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
};

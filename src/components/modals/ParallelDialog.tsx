import React, { useEffect, useRef, useState } from 'react';
import { GitCompareArrows, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { ParallelPreviewState } from '../../types';
import { StepperField } from '../ui/StepperField';

interface ParallelDialogProps {
  isOpen: boolean;
  /** Заголовок окна, напр. «Параллельная линия» / «Параллельная дуга». */
  title: string;
  /** Подпись под полями (что и откуда смещаем). */
  hint: string;
  /** Метка поля количества: «Кол-во линий» / «Кол-во дуг». */
  countLabel: string;
  onClose: () => void;
  /** Создаёт `count` параллельных копий со шагом `distance` мм. */
  onCreate: (distance: number, count: number) => void;
  /** Строит живое превью на холсте для текущих значений шага/количества. */
  makePreview: (distance: number, count: number) => ParallelPreviewState | null;
}

/** Ввод → число мм: запятая как разделитель, пусто/нечисло → 0. */
function parseMM(raw: string): number {
  const v = parseFloat(raw.replace(',', '.').trim());
  return Number.isFinite(v) ? v : 0;
}

/** Ввод → целое ≥ 1 (количество копий), пусто/нечисло → 1. */
function parseCount(raw: string): number {
  const v = parseInt(raw.trim(), 10);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/**
 * Общий модуль построения параллельных копий (линий либо дуг): шаг (мм) и количество. Знак
 * шага задаёт сторону смещения. Пока пользователь вводит значения, на холсте показывается
 * живое превью будущих копий. «Подтвердить»/Enter создаёт все копии, «Отмена»/Escape — закрывает.
 */
export const ParallelDialog: React.FC<ParallelDialogProps> = ({
  isOpen,
  title,
  hint,
  countLabel,
  onClose,
  onCreate,
  makePreview,
}) => {
  const setParallelPreview = useProjectStore((s) => s.setParallelPreview);
  const [distStr, setDistStr] = useState('16');
  const [countStr, setCountStr] = useState('1');

  // Держим свежий makePreview в ref, чтобы эффект превью не перезапускался на каждый рендер.
  const makePreviewRef = useRef(makePreview);
  makePreviewRef.current = makePreview;

  // Открыли — сбрасываем поля к значениям по умолчанию.
  useEffect(() => {
    if (isOpen) {
      setDistStr('16');
      setCountStr('1');
    }
  }, [isOpen]);

  // Гарантированно убираем превью с холста при размонтировании окна.
  useEffect(() => () => setParallelPreview(null), [setParallelPreview]);

  const distance = parseMM(distStr);
  const count = parseCount(countStr);

  // Синхронизируем живое превью со значениями полей; при закрытии снимаем.
  useEffect(() => {
    if (!isOpen) {
      setParallelPreview(null);
      return;
    }
    setParallelPreview(makePreviewRef.current(distance, count));
  }, [isOpen, distance, count, setParallelPreview]);

  if (!isOpen) return null;

  const canApply = distance !== 0 && count >= 1;

  const confirm = () => {
    if (!canApply) return;
    onCreate(distance, count);
    onClose();
  };

  // Шаг стрелками: расстояние ±1 мм, количество ±1 (не ниже 1).
  const stepDistance = (dir: 1 | -1) => setDistStr(String(parseMM(distStr) + dir));
  const stepCount = (dir: 1 | -1) => setCountStr(String(Math.max(1, parseCount(countStr) + dir)));

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
        aria-label={title}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-lg text-slate-800 dark:text-slate-100"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors"
            title="Отмена"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StepperField
            label="Шаг, мм"
            value={distStr}
            inputMode="decimal"
            autoFocus
            placeholder="16"
            onChange={setDistStr}
            onStep={stepDistance}
            onEnter={confirm}
          />
          <StepperField
            label={countLabel}
            value={countStr}
            inputMode="numeric"
            placeholder="1"
            onChange={setCountStr}
            onStep={stepCount}
            onEnter={confirm}
          />
        </div>
        <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">{hint}</p>
        <p className="mt-1 text-[12px] font-mono text-primary">
          Шаг {distance} мм · Копий {count}
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
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
};

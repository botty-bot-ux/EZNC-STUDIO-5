import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, GitCompareArrows, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { LineObject } from '../../types';
import { computeParallelSegments } from '../../lib/geometry/transform';

interface ParallelLineDialogProps {
  isOpen: boolean;
  /** Исходный отрезок — по нему считаем превью и подписываем в окне. */
  line: LineObject;
  onClose: () => void;
  /** Создаёт `count` параллельных линий со шагом `distance` мм по нормали. */
  onCreate: (distance: number, count: number) => void;
}

/** Ввод → число мм: запятая как разделитель, пусто/нечисло → 0. */
function parseMM(raw: string): number {
  const v = parseFloat(raw.replace(',', '.').trim());
  return Number.isFinite(v) ? v : 0;
}

/** Ввод → целое ≥ 1 (количество линий), пусто/нечисло → 1. */
function parseCount(raw: string): number {
  const v = parseInt(raw.trim(), 10);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

interface StepperFieldProps {
  label: string;
  value: string;
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
  onStep: (dir: 1 | -1) => void;
  onEnter: () => void;
}

/** Числовое поле с вертикальными стрелками ▲/▼ для ввода мышкой. */
const StepperField: React.FC<StepperFieldProps> = ({
  label,
  value,
  inputMode = 'decimal',
  placeholder,
  autoFocus,
  onChange,
  onStep,
  onEnter,
}) => (
  <label className="block">
    <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <div className="mt-1 flex items-stretch gap-1">
      <input
        type="text"
        inputMode={inputMode}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className="w-full min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-center focus:border-primary focus:bg-white focus:dark:bg-slate-900 focus:outline-none transition-all"
      />
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onStep(1)}
          title="Больше"
          className="flex-1 px-1.5 rounded-t-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 hover:dark:bg-slate-700 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onStep(-1)}
          title="Меньше"
          className="flex-1 px-1.5 rounded-b-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 border-t-0 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-200 hover:dark:bg-slate-700 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </label>
);

/**
 * Модуль построения параллельных линий: шаг (мм) между линиями и их количество. Знак шага
 * задаёт сторону смещения. Пока пользователь вводит значения, на холсте показывается живое
 * превью будущих линий. «Подтвердить»/Enter создаёт все линии, «Отмена»/Escape — закрывает.
 */
export const ParallelLineDialog: React.FC<ParallelLineDialogProps> = ({
  isOpen,
  line,
  onClose,
  onCreate,
}) => {
  const setParallelPreview = useProjectStore((s) => s.setParallelPreview);
  const [distStr, setDistStr] = useState('16');
  const [countStr, setCountStr] = useState('1');

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

  // Синхронизируем живое превью на холсте со значениями полей; при закрытии снимаем.
  useEffect(() => {
    if (!isOpen) {
      setParallelPreview(null);
      return;
    }
    const segments = computeParallelSegments(
      { startX: line.startX, startY: line.startY, endX: line.endX, endY: line.endY },
      distance,
      count
    );
    setParallelPreview(
      segments.length
        ? { source: { startX: line.startX, startY: line.startY, endX: line.endX, endY: line.endY }, segments }
        : null
    );
  }, [isOpen, line, distance, count, setParallelPreview]);

  if (!isOpen) return null;

  const canApply = distance !== 0 && count >= 1;

  const confirm = () => {
    if (!canApply) return;
    onCreate(distance, count);
    onClose();
  };

  // Шаг стрелками: расстояние ±1 мм (сохраняем текущий дробный формат), количество ±1.
  const stepDistance = (dir: 1 | -1) => {
    const next = parseMM(distStr) + dir;
    setDistStr(String(next));
  };
  const stepCount = (dir: 1 | -1) => {
    const next = Math.max(1, parseCount(countStr) + dir);
    setCountStr(String(next));
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
            label="Кол-во линий"
            value={countStr}
            inputMode="numeric"
            placeholder="1"
            onChange={setCountStr}
            onStep={stepCount}
            onEnter={confirm}
          />
        </div>
        <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
          От исходной «{line.name}» с шагом {distance} мм. Знак «−» меняет сторону.
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

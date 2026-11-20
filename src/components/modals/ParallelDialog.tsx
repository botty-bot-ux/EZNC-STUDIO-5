import React, { useEffect, useRef, useState } from 'react';
import { GitCompareArrows, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { ParallelPreviewState } from '../../types';
import { parseDecimal as parseMM } from '../../lib/utils/num';
import { StepperField } from '../ui/StepperField';

interface ParallelDialogProps {
  isOpen: boolean;
  title: string;
  hint: string;
  countLabel: string;
  onClose: () => void;
  onCreate: (distance: number, count: number) => void;
  makePreview: (distance: number, count: number) => ParallelPreviewState | null;
}

function parseCount(raw: string): number {
  const v = parseInt(raw.trim(), 10);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

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

  const makePreviewRef = useRef(makePreview);
  makePreviewRef.current = makePreview;

  useEffect(() => {
    if (isOpen) {
      setDistStr('16');
      setCountStr('1');
    }
  }, [isOpen]);

  useEffect(() => () => setParallelPreview(null), [setParallelPreview]);

  const distance = parseMM(distStr);
  const count = parseCount(countStr);

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

  const scrubDistance = (delta: number) => setDistStr(String(parseMM(distStr) + delta));
  const scrubCount = (delta: number) =>
    setCountStr(String(Math.max(1, parseCount(countStr) + delta)));

  return (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 w-76 select-none"
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
        className="bg-surface border border-line rounded-xl p-4 shadow-xl text-fg"
      >
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-xs text-fg">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            title="Отмена"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <StepperField
            label="Шаг, мм"
            value={distStr}
            inputMode="decimal"
            autoFocus
            placeholder="16"
            onChange={setDistStr}
            onScrub={scrubDistance}
            onEnter={confirm}
          />
          <StepperField
            label={countLabel}
            value={countStr}
            inputMode="numeric"
            placeholder="1"
            onChange={setCountStr}
            onScrub={scrubCount}
            onEnter={confirm}
          />
        </div>
        <p className="mt-2.5 text-[11px] text-muted leading-snug">{hint}</p>
        <p className="mt-1 text-[11px] font-mono text-accent">
          Шаг {distance} мм · Копий {count}
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={!canApply}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
};

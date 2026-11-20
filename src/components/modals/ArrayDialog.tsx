import React, { useEffect, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { parseDecimalOrNull } from '../../lib/utils/num';
import { StepperField } from '../ui/StepperField';

interface ArrayDialogProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onApply: (countX: number, stepX: number, countY: number, stepY: number) => void;
}

export const ArrayDialog: React.FC<ArrayDialogProps> = ({
  isOpen,
  selectedCount,
  onClose,
  onApply,
}) => {
  const [countXStr, setCountXStr] = useState('1');
  const [stepXStr, setStepXStr] = useState('32');
  const [countYStr, setCountYStr] = useState('3');
  const [stepYStr, setStepYStr] = useState('32');

  useEffect(() => {
    if (isOpen) {
      setCountXStr('1');
      setStepXStr('32');
      setCountYStr('3');
      setStepYStr('32');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseIntClamped = (s: string) => {
    const n = parseDecimalOrNull(s);
    if (n === null) return 1;
    return Math.max(1, Math.min(50, Math.round(n)));
  };

  const countX = parseIntClamped(countXStr);
  const countY = parseIntClamped(countYStr);
  const stepX = parseDecimalOrNull(stepXStr) ?? 0;
  const stepY = parseDecimalOrNull(stepYStr) ?? 0;

  const totalCopies = Math.max(0, countX * countY - 1) * selectedCount;
  const canApply =
    selectedCount > 0 &&
    totalCopies > 0 &&
    ((countX > 1 && stepX !== 0) || (countY > 1 && stepY !== 0));

  const confirm = () => {
    if (!canApply) return;
    onApply(countX, stepX, countY, stepY);
    onClose();
  };

  return (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 w-80 select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Массив копий"
        className="bg-surface border border-line rounded-xl p-4 shadow-xl text-fg"
      >
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-xs text-fg">Массив с шагом</h3>
            {selectedCount > 1 && (
              <span className="font-mono text-[11px] text-muted">· {selectedCount}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            title="Отмена"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Быстрые мебельные пресеты шага (система 32) */}
        <div className="flex items-center justify-between gap-1.5 mb-3">
          <span className="text-[11px] text-muted">Шаг (мм):</span>
          <div className="flex items-center gap-1">
            {[32, 64, 96, -32].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  if (countX > 1) setStepXStr(String(preset));
                  if (countY > 1 || countX === 1) setStepYStr(String(preset));
                }}
                className="px-1.5 py-0.5 rounded bg-surface-subtle hover:bg-surface-hover border border-line text-[11px] font-mono text-fg-secondary cursor-pointer"
              >
                {preset > 0 ? `+${preset}` : preset}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <StepperField
            label="По верт. (X), шт"
            value={countXStr}
            inputMode="numeric"
            onChange={setCountXStr}
            onScrub={(d) => setCountXStr(String(Math.max(1, Math.min(50, countX + d))))}
            onEnter={confirm}
          />
          <StepperField
            label="Шаг X, мм"
            value={stepXStr}
            inputMode="decimal"
            onChange={setStepXStr}
            onScrub={(d) => setStepXStr(String(stepX + d))}
            onEnter={confirm}
          />
          <StepperField
            label="По гориз. (Y), шт"
            value={countYStr}
            inputMode="numeric"
            autoFocus
            onChange={setCountYStr}
            onScrub={(d) => setCountYStr(String(Math.max(1, Math.min(50, countY + d))))}
            onEnter={confirm}
          />
          <StepperField
            label="Шаг Y, мм"
            value={stepYStr}
            inputMode="decimal"
            onChange={setStepYStr}
            onScrub={(d) => setStepYStr(String(stepY + d))}
            onEnter={confirm}
          />
        </div>

        <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-muted">
            Новых копий: {totalCopies}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!canApply}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              Создать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

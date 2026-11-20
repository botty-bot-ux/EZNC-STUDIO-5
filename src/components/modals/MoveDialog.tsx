import React, { useEffect, useState } from 'react';
import { Move, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { parseDecimal as parseMM } from '../../lib/utils/num';
import { StepperField } from '../ui/StepperField';

interface MoveDialogProps {
  isOpen: boolean;
  ids: string[];
  onClose: () => void;
  onApply: (dx: number, dy: number) => void;
}

export const MoveDialog: React.FC<MoveDialogProps> = ({ isOpen, ids, onClose, onApply }) => {
  const setLiveMove = useProjectStore((s) => s.setLiveMove);
  const [xStr, setXStr] = useState('');
  const [yStr, setYStr] = useState('');

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

  const scrubX = (delta: number) => changeX(String(parseMM(xStr) + delta));
  const scrubY = (delta: number) => changeY(String(parseMM(yStr) + delta));

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
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 w-72 select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          cancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Переместить"
        className="bg-surface border border-line rounded-xl p-4 shadow-xl text-fg"
      >
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-xs text-fg">Смещение по координатам</h3>
            {ids.length > 1 && (
              <span className="font-mono text-[11px] text-muted">· {ids.length}</span>
            )}
          </div>
          <button
            onClick={cancel}
            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            title="Отмена"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <StepperField
            label="dX, мм"
            value={xStr}
            inputMode="decimal"
            autoFocus
            placeholder="0"
            onChange={changeX}
            onScrub={scrubX}
            onEnter={confirm}
          />
          <StepperField
            label="dY, мм"
            value={yStr}
            inputMode="decimal"
            placeholder="0"
            onChange={changeY}
            onScrub={scrubY}
            onEnter={confirm}
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={cancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={!canApply}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

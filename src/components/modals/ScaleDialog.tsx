import React, { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { parseDecimalOrNull } from '../../lib/utils/num';
import { Point2D } from '../../types';
import { StepperField } from '../ui/StepperField';

type ScaleAxis = 'both' | 'x' | 'y';

interface ScaleDialogProps {
  isOpen: boolean;
  ids: string[];
  anchor: Point2D;
  onClose: () => void;
  onApply: (anchor: Point2D, sx: number, sy: number) => void;
}

const AXES: { id: ScaleAxis; label: string }[] = [
  { id: 'both', label: 'Обе оси' },
  { id: 'x', label: 'Гориз. X' },
  { id: 'y', label: 'Верт. Y' },
];

export const ScaleDialog: React.FC<ScaleDialogProps> = ({ isOpen, ids, anchor, onClose, onApply }) => {
  const setLiveScale = useProjectStore((s) => s.setLiveScale);
  const [axis, setAxis] = useState<ScaleAxis>('both');
  const [pctStr, setPctStr] = useState('');

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

  const factors = (pct: number, targetAxis: ScaleAxis = axis): { sx: number; sy: number } => {
    const s = pct / 100;
    return { sx: targetAxis === 'y' ? 1 : s, sy: targetAxis === 'x' ? 1 : s };
  };
  const parsedPct = parseDecimalOrNull(pctStr);
  const validPct = parsedPct !== null && parsedPct !== 0;
  const { sx, sy } = validPct ? factors(parsedPct) : { sx: 1, sy: 1 };
  const canApply = ids.length > 0 && validPct && (sx !== 1 || sy !== 1);

  const changePct = (v: string) => {
    setPctStr(v);
    const n = parseDecimalOrNull(v);
    if (n !== null && n !== 0) {
      setLiveScale({ ids, anchor, ...factors(n) });
    } else {
      setLiveScale(null);
    }
  };

  const scrub = (delta: number) => {
    const cur = parseDecimalOrNull(pctStr) ?? 100;
    let next = cur + delta * 10;
    if (next === 0) next = delta > 0 ? 10 : -10;
    changePct(String(next));
  };

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
    const n = parseDecimalOrNull(pctStr);
    if (n !== null && n !== 0) {
      setLiveScale({ ids, anchor, ...factors(n, a) });
    } else {
      setLiveScale(null);
    }
  };

  return (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 w-76 select-none"
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
        className="bg-surface border border-line rounded-xl p-4 shadow-xl text-fg"
      >
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-xs text-fg">Масштабирование</h3>
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

        <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-surface-subtle border border-line p-0.5">
          {AXES.map((a) => (
            <button
              key={a.id}
              onClick={() => changeAxis(a.id)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                axis === a.id
                  ? 'bg-primary text-primary-fg font-semibold'
                  : 'text-muted hover:text-fg'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
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
          <p className="mt-2 text-[11px] leading-snug text-muted">
            {axis === 'x'
              ? 'Растяжение по горизонтали (X) от центра выделения.'
              : axis === 'y'
              ? 'Растяжение по вертикали (Y) от центра выделения.'
              : 'Равномерно по обеим осям от центра выделения.'}{' '}
            120 — увеличить в 1,2 раза; «−» отражает фигуру.
          </p>
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

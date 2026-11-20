import React, { useEffect, useState } from 'react';
import { RotateCw, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { parseDecimalOrNull } from '../../lib/utils/num';
import { Point2D } from '../../types';
import { StepperField } from '../ui/StepperField';

type RotateAnchorMode = 'selection' | 'origin';

interface RotateDialogProps {
  isOpen: boolean;
  ids: string[];
  selectionCenter: Point2D;
  hasRectangle: boolean;
  onClose: () => void;
  onApply: (angleDeg: number, anchorMode: RotateAnchorMode) => void;
}

const PRESET_ANGLES = [-90, -45, -15, 15, 45, 90, 180];

export const RotateDialog: React.FC<RotateDialogProps> = ({
  isOpen,
  ids,
  selectionCenter,
  hasRectangle,
  onClose,
  onApply,
}) => {
  const setLiveRotate = useProjectStore((s) => s.setLiveRotate);
  const [anchorMode, setAnchorMode] = useState<RotateAnchorMode>('selection');
  const [angleStr, setAngleStr] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnchorMode('selection');
      setAngleStr('');
      setLiveRotate(null);
    } else {
      setLiveRotate(null);
    }
  }, [isOpen, setLiveRotate]);

  if (!isOpen) return null;

  const anchorFor = (mode: RotateAnchorMode): Point2D =>
    mode === 'origin' ? { x: 0, y: 0 } : selectionCenter;

  const parsed = parseDecimalOrNull(angleStr);
  const valid = parsed !== null && Math.abs(parsed) > 1e-6;
  const canApply = ids.length > 0 && valid;

  const updateAngle = (v: string, mode: RotateAnchorMode = anchorMode) => {
    setAngleStr(v);
    const n = parseDecimalOrNull(v);
    if (n !== null && Math.abs(n) > 1e-6) {
      setLiveRotate({ ids, anchor: anchorFor(mode), angleDeg: n });
    } else {
      setLiveRotate(null);
    }
  };

  const scrub = (delta: number) => {
    const cur = parseDecimalOrNull(angleStr) ?? 0;
    const next = Math.round((cur + delta * 5) * 10) / 10;
    updateAngle(next === 0 ? '' : String(next));
  };

  const cancel = () => {
    setLiveRotate(null);
    onClose();
  };

  const confirm = () => {
    if (!canApply || parsed === null) return;
    setLiveRotate(null);
    onApply(parsed, anchorMode);
    onClose();
  };

  const isMultipleOf90 = parsed !== null && Math.abs(parsed % 90) < 1e-4;

  return (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 w-80 select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          cancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Повернуть на угол"
        className="bg-surface border border-line rounded-xl p-4 shadow-xl text-fg"
      >
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-xs text-fg">Поворот на угол</h3>
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

        {/* Выбор опорной точки */}
        <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-surface-subtle border border-line p-0.5">
          {[
            { id: 'selection' as const, label: 'Центр выделения' },
            { id: 'origin' as const, label: 'Ноль (0, 0)' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setAnchorMode(opt.id);
                updateAngle(angleStr, opt.id);
              }}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                anchorMode === opt.id
                  ? 'bg-primary text-primary-fg font-semibold'
                  : 'text-muted hover:text-fg'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <StepperField
            label="Угол, °"
            value={angleStr}
            inputMode="decimal"
            autoFocus
            placeholder="45"
            onChange={(v) => updateAngle(v)}
            onScrub={scrub}
            onEnter={confirm}
          />
        </div>

        {/* Быстрые углы */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {PRESET_ANGLES.map((deg) => {
            const active = parsed !== null && Math.abs(parsed - deg) < 1e-4;
            return (
              <button
                key={deg}
                type="button"
                onClick={() => updateAngle(String(deg))}
                className={`px-2 py-1 rounded-md font-mono text-[11px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-primary-fg border-primary font-semibold'
                    : 'bg-surface-subtle hover:bg-surface-hover border-line text-fg-secondary'
                }`}
              >
                {deg > 0 ? `+${deg}°` : `${deg}°`}
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 text-[11px] leading-snug text-muted">
          {hasRectangle && valid && !isMultipleOf90
            ? 'Прямоугольник при некратном 90° угле станет замкнутым контуром.'
            : 'Положительное значение — против часовой стрелки, «−» — по часовой.'}
        </p>

        <div className="mt-3.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
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
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  FlipHorizontal2,
  FlipVertical2,
  GitCompareArrows,
  LayoutGrid,
  Link2,
  Maximize2,
  Move,
  RotateCw,
} from 'lucide-react';
import { ShapeDialogState } from '../../../store/projectStore.types';

interface TransformActionsGridProps {
  disabled: boolean;
  isGroup: boolean;
  showScale?: boolean;
  parallelKind?: 'line' | 'arc' | null;
  showJoin?: boolean;
  joinDisabled?: boolean;
  onOpenDialog: (dialog: NonNullable<ShapeDialogState>) => void;
  onMirror: (axis: 'x' | 'y') => void;
  onRotate90: () => void;
  onJoin?: () => void;
}

export const TransformActionsGrid: React.FC<TransformActionsGridProps> = ({
  disabled,
  isGroup,
  showScale = true,
  parallelKind = null,
  showJoin = false,
  joinDisabled = false,
  onOpenDialog,
  onMirror,
  onRotate90,
  onJoin,
}) => {
  const btnCls =
    'py-1.5 px-2 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-line text-[11px] font-medium text-fg-secondary disabled:opacity-35 flex items-center justify-center gap-1 cursor-pointer';
  const fullBtnCls =
    'col-span-3 py-1.5 px-2 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-line text-[11px] font-medium text-fg-secondary disabled:opacity-35 flex items-center justify-center gap-1.5 cursor-pointer';

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenDialog({ kind: 'move' })}
        title={isGroup ? 'Сместить группу на точное расстояние X/Y' : 'Сместить на точное расстояние по X/Y'}
        className={btnCls}
      >
        <Move className="w-3.5 h-3.5 text-muted shrink-0" />
        <span>Сместить</span>
      </button>

      {showScale && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpenDialog({ kind: 'scale' })}
          title={isGroup ? 'Масштабировать группу по X/Y' : 'Масштабировать по осям X/Y'}
          className={btnCls}
        >
          <Maximize2 className="w-3.5 h-3.5 text-muted shrink-0" />
          <span>Масштаб</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onOpenDialog({ kind: 'array' })}
        title={isGroup ? 'Массив копий с шагом' : 'Создать ряд/сетку копий с заданным шагом (32 мм и др.)'}
        className="py-1.5 px-2 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-line text-[11px] font-medium text-fg-secondary flex items-center justify-center gap-1 cursor-pointer"
      >
        <LayoutGrid className="w-3.5 h-3.5 text-muted shrink-0" />
        <span>Массив</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onMirror('y')}
        title="Отзеркалить по горизонтали (влево-вправо)"
        className={btnCls}
      >
        <FlipHorizontal2 className="w-3.5 h-3.5 text-muted shrink-0" />
        <span>Зерк. Г</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onMirror('x')}
        title="Отзеркалить по вертикали (вверх-вниз)"
        className={btnCls}
      >
        <FlipVertical2 className="w-3.5 h-3.5 text-muted shrink-0" />
        <span>Зерк. В</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onRotate90}
        title={isGroup ? 'Повернуть группу на 90°' : 'Повернуть на 90° вокруг центра фигуры'}
        className={btnCls}
      >
        <RotateCw className="w-3.5 h-3.5 text-muted shrink-0" />
        <span>90°</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenDialog({ kind: 'rotate' })}
        title={isGroup ? 'Повернуть группу на произвольный угол в градусах' : 'Повернуть на произвольный угол в градусах'}
        className={fullBtnCls}
      >
        <RotateCw className="w-3.5 h-3.5 text-muted shrink-0" />
        <span>Повернуть на угол…</span>
      </button>

      {showJoin && onJoin && (
        <button
          type="button"
          disabled={disabled || joinDisabled}
          onClick={onJoin}
          title="Склеить выбранные соприкасающиеся отрезки и открытые полилинии в единый контур (допуск 0.5 мм)"
          className={fullBtnCls}
        >
          <Link2 className="w-3.5 h-3.5 text-muted shrink-0" />
          <span>Объединить в контур (Join)</span>
        </button>
      )}

      {parallelKind && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpenDialog({ kind: 'parallel' })}
          title={
            parallelKind === 'arc'
              ? 'Параллельная дуга (концентрическое смещение)'
              : 'Параллельная линия (смещение по нормали)'
          }
          className={fullBtnCls}
        >
          <GitCompareArrows className="w-3.5 h-3.5 text-muted shrink-0" />
          <span>
            {parallelKind === 'arc' ? 'Параллельная дуга…' : 'Параллельная линия…'}
          </span>
        </button>
      )}
    </div>
  );
};

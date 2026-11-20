import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  GitCompareArrows,
  LayoutGrid,
  Link2,
  Lock,
  Maximize2,
  Move,
  RotateCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';

interface ShapeContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

interface ContextMenuItemProps {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ Icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
      danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-surface-hover'
    }`}
  >
    <Icon className={`w-3.5 h-3.5 shrink-0 ${danger ? 'text-danger' : 'text-muted'}`} />
    <span>{label}</span>
  </button>
);

export const ShapeContextMenu: React.FC<ShapeContextMenuProps> = ({ x, y, onClose }) => {
  const {
    objects,
    selectedObjectIds,
    updateSelectedObjects,
    deleteSelectedObjects,
    duplicateObject,
    mirrorSelectedObjects,
    rotateSelectedObjects,
    joinSelectedObjects,
    setShapeDialog,
  } = useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      updateSelectedObjects: s.updateSelectedObjects,
      deleteSelectedObjects: s.deleteSelectedObjects,
      duplicateObject: s.duplicateObject,
      mirrorSelectedObjects: s.mirrorSelectedObjects,
      rotateSelectedObjects: s.rotateSelectedObjects,
      joinSelectedObjects: s.joinSelectedObjects,
      setShapeDialog: s.setShapeDialog,
    }))
  );

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onWheel = () => onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [onClose]);

  const selObjs = objects.filter((o) => selectedObjectIds.includes(o.id));
  if (selObjs.length === 0) return null;

  const plural = selObjs.length > 1;
  const allVisible = selObjs.every((o) => o.visible !== false);
  const allFrozen = selObjs.every((o) => o.frozen === true);
  const primary = selObjs[selObjs.length - 1];
  const showParallel = !plural && !primary.frozen && (primary.type === 'line' || primary.type === 'arc');
  const showScale = plural || primary.type !== 'point';
  const hasJoinable =
    selObjs.filter(
      (o) => !o.frozen && (o.type === 'line' || (o.type === 'polyline' && !o.closed && o.points.length >= 2))
    ).length >= 2;

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const MENU_W = 224;
  const MENU_H = 470;
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8));

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface rounded-xl border border-line shadow-lg p-1 flex flex-col gap-0.5 select-none"
      style={{ left, top, width: MENU_W }}
    >
      <ContextMenuItem
        Icon={allVisible ? Eye : EyeOff}
        label={
          allVisible
            ? plural
              ? 'Скрыть выбранные'
              : 'Скрыть фигуру'
            : plural
            ? 'Показать выбранные'
            : 'Показать фигуру'
        }
        onClick={run(() => updateSelectedObjects({ visible: !allVisible }))}
      />
      <ContextMenuItem
        Icon={allFrozen ? Lock : Unlock}
        label={allFrozen ? 'Разблокировать' : 'Зафиксировать'}
        onClick={run(() => updateSelectedObjects({ frozen: !allFrozen }))}
      />
      {!plural && (
        <ContextMenuItem
          Icon={Copy}
          label="Дублировать"
          onClick={run(() => duplicateObject(primary.id))}
        />
      )}
      {!allFrozen && (
        <ContextMenuItem
          Icon={Move}
          label="Переместить…"
          onClick={run(() => setShapeDialog({ kind: 'move' }))}
        />
      )}
      {!allFrozen && showScale && (
        <ContextMenuItem
          Icon={Maximize2}
          label="Масштабировать…"
          onClick={run(() => setShapeDialog({ kind: 'scale' }))}
        />
      )}
      {showParallel && (
        <ContextMenuItem
          Icon={GitCompareArrows}
          label={primary.type === 'arc' ? 'Параллельная дуга…' : 'Параллельная линия…'}
          onClick={run(() => setShapeDialog({ kind: 'parallel' }))}
        />
      )}
      {!allFrozen && (
        <>
          <ContextMenuItem
            Icon={FlipHorizontal2}
            label="Отзеркалить гориз."
            onClick={run(() => mirrorSelectedObjects('y'))}
          />
          <ContextMenuItem
            Icon={FlipVertical2}
            label="Отзеркалить верт."
            onClick={run(() => mirrorSelectedObjects('x'))}
          />
          <ContextMenuItem
            Icon={RotateCw}
            label="Повернуть на 90°"
            onClick={run(() => rotateSelectedObjects(90))}
          />
          <ContextMenuItem
            Icon={RotateCw}
            label="Повернуть на угол…"
            onClick={run(() => setShapeDialog({ kind: 'rotate' }))}
          />
          {hasJoinable && (
            <ContextMenuItem
              Icon={Link2}
              label="Объединить в контур"
              onClick={run(() => joinSelectedObjects())}
            />
          )}
        </>
      )}
      <ContextMenuItem
        Icon={LayoutGrid}
        label="Массив с шагом…"
        onClick={run(() => setShapeDialog({ kind: 'array' }))}
      />
      <div className="h-px bg-line my-1 mx-1" />
      <ContextMenuItem
        Icon={Trash2}
        label={plural ? 'Удалить выбранные' : 'Удалить'}
        danger
        onClick={run(() => deleteSelectedObjects())}
      />
    </div>
  );
};

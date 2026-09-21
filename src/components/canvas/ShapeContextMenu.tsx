import React, { useEffect, useRef } from 'react';
import { Eye, EyeOff, GitCompareArrows, Lock, Move, Trash2, Unlock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';

interface ShapeContextMenuProps {
  /** Экранные координаты (clientX/clientY) точки правого клика. */
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Правый клик по фигуре на холсте: те же действия, что в шапке панели «Свойства»
 * (показать/скрыть, заморозить, переместить, параллельная линия/дуга, удалить).
 * Работает по текущему выделению: клик по невыделенной фигуре сначала выделяет её.
 */
export const ShapeContextMenu: React.FC<ShapeContextMenuProps> = ({ x, y, onClose }) => {
  const {
    objects,
    selectedObjectIds,
    updateSelectedObjects,
    deleteSelectedObjects,
    setShapeDialog,
  } = useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      updateSelectedObjects: s.updateSelectedObjects,
      deleteSelectedObjects: s.deleteSelectedObjects,
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
    // Скролл/зум уводят якорь — проще закрыть, чем пересчитывать позицию.
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

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const MENU_W = 232;
  const MENU_H = 260;
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8));

  const Item: React.FC<{
    Icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    danger?: boolean;
    iconClass?: string;
  }> = ({ Icon, label, onClick, danger, iconClass }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors text-left ${
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${iconClass ?? (danger ? 'text-danger' : 'text-accent')}`} />
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md p-1.5 flex flex-col gap-0.5 select-none"
      style={{ left, top, width: MENU_W }}
    >
      <Item
        Icon={allVisible ? Eye : EyeOff}
        label={allVisible
          ? plural ? 'Скрыть выбранные фигуры' : 'Скрыть фигуру'
          : plural ? 'Показать выбранные фигуры' : 'Показать фигуру'}
        onClick={run(() => updateSelectedObjects({ visible: !allVisible }))}
      />
      <Item
        Icon={allFrozen ? Lock : Unlock}
        label={allFrozen ? 'Разморозить' : 'Заморозить'}
        onClick={run(() => updateSelectedObjects({ frozen: !allFrozen }))}
      />
      {!allFrozen && (
        <Item
          Icon={Move}
          label="Переместить"
          onClick={run(() => setShapeDialog({ kind: 'move' }))}
        />
      )}
      {showParallel && (
        <Item
          Icon={GitCompareArrows}
          label={primary.type === 'arc' ? 'Параллельная дуга' : 'Параллельная линия'}
          onClick={run(() => setShapeDialog({ kind: 'parallel' }))}
        />
      )}
      <div className="h-px bg-slate-200/80 dark:bg-slate-700/80 my-1 mx-1" />
      <Item
        Icon={Trash2}
        label={plural ? 'Удалить выбранные' : 'Удалить'}
        danger
        onClick={run(() => deleteSelectedObjects())}
      />
    </div>
  );
};

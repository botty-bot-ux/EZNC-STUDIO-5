import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  LineDotRightHorizontal,
  Spline,
  Square,
  Trash2,
} from 'lucide-react';
import { CADObject } from '../../types';

interface FigureRowProps {
  obj: CADObject;
  index: number;
  totalCount: number;
  isSelected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (partial: Partial<CADObject>) => void;
}

// Строка фигуры в левом дереве: текст на прозрачном фоне.
// Выбранная фигура подсвечивается синим. Действия — при наведении.
export const LayerItemAccordion: React.FC<FigureRowProps> = ({
  obj,
  index,
  totalCount,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDuplicate,
  onUpdate,
}) => {
  const isVisible = obj.visible !== false;

  const TypeIcon: React.ComponentType<{ className?: string }> =
    obj.type === 'point'
      ? CircleDot
      : obj.type === 'line'
      ? LineDotRightHorizontal
      : obj.type === 'rectangle'
      ? Square
      : obj.type === 'circle'
      ? Circle
      : obj.type === 'arc'
      ? Spline
      : LineDotRightHorizontal;

  const displayName =
    obj.type === 'point'
      ? obj.name.replace(/Ø?\d+(\.\d+)?\s*мм\s*/gi, ' ').replace(/\s+/g, ' ').trim()
      : obj.name;

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer select-none transition-colors ${
        isSelected ? 'bg-blue-500/10' : 'hover:bg-slate-500/5 hover:dark:bg-slate-500/5'
      }`}
    >
      <TypeIcon
        className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} ${
          isVisible ? '' : 'opacity-40'
        }`}
      />

      <span
        title={obj.name}
        className={`flex-1 min-w-0 truncate text-xs ${
          isSelected
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : isVisible
            ? 'text-slate-700 dark:text-slate-200'
            : 'text-slate-400 dark:text-slate-500 line-through'
        }`}
      >
        {displayName || obj.name}
      </span>

      {/* Hover actions (на телефоне — всегда видны, hover отсутствует) */}
      <div
        className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          title="Выше"
          className="p-0.5 rounded text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:dark:text-blue-400 disabled:opacity-0"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === totalCount - 1}
          title="Ниже"
          className="p-0.5 rounded text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:dark:text-blue-400 disabled:opacity-0"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ visible: !isVisible })}
          title={isVisible ? 'Скрыть' : 'Показать'}
          className="p-0.5 rounded text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:dark:text-blue-400"
        >
          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title="Дублировать"
          className="p-0.5 rounded text-slate-400 dark:text-slate-500 hover:text-amber-600 hover:dark:text-amber-400"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Удалить"
          className="p-0.5 rounded text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:dark:text-rose-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

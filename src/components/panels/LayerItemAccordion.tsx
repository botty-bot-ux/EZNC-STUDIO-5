import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Eye,
  EyeOff,
  LineDotRightHorizontal,
  Lock,
  Spline,
  Square,
  Trash2,
  Waypoints,
} from 'lucide-react';
import { CADObject } from '../../types';

interface FigureRowProps {
  obj: CADObject;
  index: number;
  totalCount: number;
  isSelected: boolean;
  isActive?: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdate: (partial: Partial<CADObject>) => void;
}

function getMetricSummary(obj: CADObject): string {
  switch (obj.type) {
    case 'point':
      return `Ø${obj.diameter}`;
    case 'line': {
      const len = Math.hypot(obj.endX - obj.startX, obj.endY - obj.startY);
      return `${Math.round(len)} мм`;
    }
    case 'arc':
      return `R${Math.round(obj.radius)}`;
    case 'circle':
      return `R${Math.round(obj.radius)}`;
    case 'rectangle':
      return `${Math.round(obj.width)}×${Math.round(obj.height)}`;
    case 'polyline':
      return `${obj.points.length} тчк`;
  }
}

export const LayerItemAccordion: React.FC<FigureRowProps> = ({
  obj,
  index,
  totalCount,
  isSelected,
  isActive = false,
  onSelect,
  onDoubleClick,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdate,
}) => {
  const isVisible = obj.visible !== false;
  const isFrozen = obj.frozen === true;

  const TypeIcon: React.ComponentType<{ className?: string }> =
    obj.type === 'point'
      ? CircleDot
      : obj.type === 'line'
      ? LineDotRightHorizontal
      : obj.type === 'polyline'
      ? Waypoints
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

  const metric = getMetricSummary(obj);

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      title="Двойной клик — приблизить фигуру на 2D-холсте"
      className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors ${
        isActive
          ? 'bg-warning/15 ring-1 ring-inset ring-warning/50'
          : isSelected
          ? 'bg-accent/12 text-fg'
          : 'hover:bg-surface-hover'
      }`}
    >
      {/* Порядковый номер операции в маршруте */}
      <span className="font-mono text-[11px] text-muted w-4 shrink-0 text-right">
        {String(index + 1).padStart(2, '0')}
      </span>

      <TypeIcon
        className={`w-3.5 h-3.5 shrink-0 ${
          isActive
            ? 'text-warning'
            : isSelected
            ? 'text-accent'
            : 'text-muted'
        } ${isVisible ? '' : 'opacity-40'}`}
      />

      <span
        title={obj.name}
        className={`flex-1 min-w-0 truncate text-xs ${
          isSelected
            ? 'text-fg font-semibold'
            : isVisible
            ? 'text-fg-secondary'
            : 'text-muted line-through'
        }`}
      >
        {displayName || obj.name}
      </span>

      {isFrozen && (
        <span title="Зафиксировано" className="shrink-0 flex items-center">
          <Lock className="w-3 h-3 text-muted" />
        </span>
      )}

      {/* Краткая метрика (скрывается при наведении на десктопе, уступая место кнопкам) */}
      <span className="hidden md:inline group-hover:hidden font-mono text-[11px] text-muted shrink-0">
        {isActive ? 'РЕЗ' : metric}
      </span>

      {/* Быстрые действия со строкой */}
      <div
        className="flex md:hidden md:group-hover:flex focus-within:flex items-center gap-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          title="Поднять выше в порядке резки"
          className="p-0.5 rounded text-muted hover:text-fg disabled:opacity-20 cursor-pointer"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === totalCount - 1}
          title="Опустить ниже в порядке резки"
          className="p-0.5 rounded text-muted hover:text-fg disabled:opacity-20 cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ visible: !isVisible })}
          title={isVisible ? 'Скрыть из программы' : 'Включить в программу'}
          className="p-0.5 rounded text-muted hover:text-fg cursor-pointer"
        >
          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Удалить объект"
          className="p-0.5 rounded text-muted hover:text-danger cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

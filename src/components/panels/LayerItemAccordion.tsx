import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDot,
  Compass,
  Copy,
  Eye,
  EyeOff,
  Square,
  Trash2,
  TrendingUp,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import {
  ArcObject,
  CADObject,
  CircleObject,
  LineObject,
  PointHoleObject,
  RectangleObject,
} from '../../types';
import { ArcProperties } from './properties/ArcProperties';
import { CircleProperties } from './properties/CircleProperties';
import { LineProperties } from './properties/LineProperties';
import { PointProperties } from './properties/PointProperties';
import { RectangleProperties } from './properties/RectangleProperties';

interface LayerItemAccordionProps {
  obj: CADObject;
  index: number;
  totalCount: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (partial: Partial<CADObject>) => void;
}

export const LayerItemAccordion: React.FC<LayerItemAccordionProps> = ({
  obj,
  index,
  totalCount,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDuplicate,
  onUpdate,
}) => {
  const isVisible = obj.visible !== false;
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(obj.name);

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== obj.name) {
      onUpdate({ name: trimmed });
    } else {
      setEditedName(obj.name);
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditedName(obj.name);
      setIsEditingName(false);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all text-xs select-none overflow-hidden ${
        isSelected
          ? 'bg-blue-50/90 border-blue-500/80 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
          : isVisible
          ? 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-sm'
          : 'bg-slate-50/80 border-slate-200/60 text-slate-400 opacity-70'
      }`}
    >
      {/* Primary Row Header */}
      <div
        onClick={onSelect}
        className="px-2.5 py-2 flex items-center justify-between cursor-pointer gap-2 min-h-[40px]"
      >
        <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
          {/* Reorder Arrows */}
          <div className="flex flex-col shrink-0 text-slate-400 hover:text-slate-600">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={index === 0}
              title="Переместить выше"
              className="p-0.5 hover:text-blue-600 disabled:opacity-20 transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={index === totalCount - 1}
              title="Переместить ниже"
              className="p-0.5 hover:text-blue-600 disabled:opacity-20 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Visibility Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ visible: !isVisible });
            }}
            title={isVisible ? 'Скрыть слой' : 'Показать слой'}
            className={`p-1 rounded-md shrink-0 transition-colors ${
              isVisible
                ? 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            {isVisible ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {/* Shape Icon Badge */}
          <div className="p-1 rounded-md bg-slate-100 shrink-0">
            {obj.type === 'point' && <CircleDot className="w-3.5 h-3.5 text-purple-600" />}
            {obj.type === 'line' && <TrendingUp className="w-3.5 h-3.5 text-blue-600" />}
            {obj.type === 'rectangle' && <Square className="w-3.5 h-3.5 text-amber-600" />}
            {obj.type === 'circle' && <Circle className="w-3.5 h-3.5 text-emerald-600" />}
            {obj.type === 'arc' && <Compass className="w-3.5 h-3.5 text-cyan-600" />}
          </div>

          {/* Layer Name (Editable on double click or icon click) */}
          {isEditingName ? (
            <div
              className="flex items-center gap-1 flex-1 min-w-0"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full bg-white border border-blue-500 rounded px-1.5 py-0.5 text-xs font-medium text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveName}
                title="Сохранить имя"
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditedName(obj.name);
                  setIsEditingName(false);
                }}
                title="Отмена"
                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              title="Двойной клик для переименования"
              className={`truncate text-xs font-medium flex-1 cursor-pointer ${
                isSelected ? 'text-blue-950 font-bold' : 'text-slate-800'
              } ${!isVisible ? 'line-through opacity-70' : ''}`}
            >
              {obj.name}
            </span>
          )}
        </div>

        {/* Action Controls */}
        {!isEditingName && (
          <div
            className="flex items-center gap-0.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Rename Icon */}
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              title="Переименовать"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>

            {/* Duplicate */}
            <button
              type="button"
              onClick={onDuplicate}
              title="Дублировать слой"
              className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={onDelete}
              title="Удалить слой"
              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>

            {/* Expand Accordion Button */}
            <button
              type="button"
              onClick={() => {
                onSelect();
                onToggleExpand();
              }}
              title={isExpanded ? 'Свернуть параметры' : 'Параметры фигуры'}
              className={`p-1 rounded transition-transform ${
                isExpanded
                  ? 'bg-blue-100 text-blue-700 rotate-90'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Accordion Body: Shape Parameters Drawer */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="border-t border-slate-200/80 bg-slate-50/90 p-2.5 text-xs text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white p-2 rounded-lg border border-slate-200/90 shadow-inner">
              {obj.type === 'point' && (
                <PointProperties
                  obj={obj as PointHoleObject}
                  onUpdate={(partial) => onUpdate(partial)}
                />
              )}

              {obj.type === 'line' && (
                <LineProperties
                  obj={obj as LineObject}
                  onUpdate={(partial) => onUpdate(partial)}
                />
              )}

              {obj.type === 'rectangle' && (
                <RectangleProperties
                  obj={obj as RectangleObject}
                  onUpdate={(partial) => onUpdate(partial)}
                />
              )}

              {obj.type === 'circle' && (
                <CircleProperties
                  obj={obj as CircleObject}
                  onUpdate={(partial) => onUpdate(partial)}
                />
              )}

              {obj.type === 'arc' && (
                <ArcProperties
                  obj={obj as ArcObject}
                  onUpdate={(partial) => onUpdate(partial)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


import React from 'react';
import { Minus, Waypoints, Hexagon } from 'lucide-react';
import { LineMode } from '../../types';

interface LineModeOption {
  id: LineMode;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const OPTIONS: LineModeOption[] = [
  {
    id: 'line',
    label: 'Линия',
    hint: 'Обычная линия: клик старт, клик конец — одно звено.',
    Icon: Minus,
  },
  {
    id: 'polyline',
    label: 'Полилиния',
    hint: 'Ломаная из нескольких звеньев: кликай узлы, Enter или двойной клик — завершить.',
    Icon: Waypoints,
  },
  {
    id: 'polygon',
    label: 'Контур',
    hint: 'Замкнутая полилиния: кликай узлы, клик по первой точке или Enter — замкнуть.',
    Icon: Hexagon,
  },
];

interface LineModeSelectorProps {
  value: LineMode;
  onChange: (mode: LineMode) => void;
}

/**
 * Плавающий переключатель способа построения линии. Показывается, когда активен
 * инструмент «Линия». Меняет под-режим (lineMode) в сторе.
 */
export const LineModeSelector: React.FC<LineModeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-2xl shadow-md text-slate-700 dark:text-slate-200 max-w-[95vw]">
      <span className="px-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
        Линия:
      </span>
      {OPTIONS.map(({ id, label, hint, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            title={hint}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              active
                ? 'bg-primary text-primary-fg'
                : 'hover:bg-slate-100 hover:dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

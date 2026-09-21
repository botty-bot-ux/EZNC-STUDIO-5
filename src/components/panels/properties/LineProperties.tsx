import React from 'react';
import { ArrowLeftRight, GitCompareArrows } from 'lucide-react';
import { useProjectStore } from '../../../store/useProjectStore';
import { LineObject } from '../../../types';
import { PropertyInput } from './PropertyInput';

interface LinePropertiesProps {
  obj: LineObject;
  onUpdate: (partial: Partial<LineObject>) => void;
}

export const LineProperties: React.FC<LinePropertiesProps> = ({ obj, onUpdate }) => {
  const addObject = useProjectStore((s) => s.addObject);

  // Отступ новой параллельной линии, мм. Отрицательное значение смещает на другую сторону.
  const [offset, setOffset] = React.useState(16);

  const handleSwapPoints = () => {
    onUpdate({
      startX: obj.endX,
      startY: obj.endY,
      endX: obj.startX,
      endY: obj.startY,
    });
  };

  // Строит копию линии, смещённую перпендикулярно на `offset` мм, и добавляет её в проект.
  const handleCreateParallel = () => {
    const dx = obj.endX - obj.startX;
    const dy = obj.endY - obj.startY;
    const len = Math.hypot(dx, dy);
    if (len === 0) return; // нулевая линия — направления нет

    // Единичная нормаль к вектору отрезка.
    const nx = -dy / len;
    const ny = dx / len;

    addObject({
      type: 'line',
      name: `${obj.name} параллель`,
      depth: obj.depth,
      operationType: obj.operationType,
      color: obj.color,
      visible: true,
      startX: obj.startX + nx * offset,
      startY: obj.startY + ny * offset,
      endX: obj.endX + nx * offset,
      endY: obj.endY + ny * offset,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {/* Точка 1 (X1, Y1) */}
        <div className="flex-1 space-y-1.5">
          <PropertyInput label="X1, мм" value={obj.startX} onChange={(startX) => onUpdate({ startX })} />
          <PropertyInput label="Y1, мм" value={obj.startY} onChange={(startY) => onUpdate({ startY })} />
        </div>

        {/* Кнопка "Поменять точки местами" */}
        <button
          type="button"
          onClick={handleSwapPoints}
          title="Поменять начальную и конечную точки местами"
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-600 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors shrink-0 flex items-center justify-center self-center"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        {/* Точка 2 (X2, Y2) */}
        <div className="flex-1 space-y-1.5">
          <PropertyInput label="X2, мм" value={obj.endX} onChange={(endX) => onUpdate({ endX })} />
          <PropertyInput label="Y2, мм" value={obj.endY} onChange={(endY) => onUpdate({ endY })} />
        </div>
      </div>

      {/* Создание параллельной линии: отступ + кнопка */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <PropertyInput label="Отступ, мм" value={offset} onChange={setOffset} step="0.5" />
        </div>
        <button
          type="button"
          onClick={handleCreateParallel}
          title="Добавить линию, параллельную текущей, со смещением по нормали (минус — на другую сторону)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 active:opacity-100 transition-all shrink-0 cursor-pointer"
        >
          <GitCompareArrows className="w-4 h-4" />
          Параллельная линия
        </button>
      </div>
    </div>
  );
};

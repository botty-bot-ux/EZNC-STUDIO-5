import React from 'react';
import { Circle, CircleDot, Compass, Sliders, Square, Trash2, TrendingUp } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { ArcObject, CircleObject, LineObject, PointHoleObject, RectangleObject } from '../../types';
import { ArcProperties } from './properties/ArcProperties';
import { CircleProperties } from './properties/CircleProperties';
import { LineProperties } from './properties/LineProperties';
import { PointProperties } from './properties/PointProperties';
import { RectangleProperties } from './properties/RectangleProperties';

export const PropertiesPanel: React.FC = () => {
  const { selectedObjectId, objects, updateObject, deleteObject } = useProjectStore();

  const selectedObj = objects.find((o) => o.id === selectedObjectId);

  if (!selectedObj) {
    return (
      <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-full gap-2 select-none">
        <Sliders className="w-8 h-8 opacity-40 text-slate-400" />
        <p>Выберите объект на холсте или в списке слева для просмотра и редактирования его свойств.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-xs text-slate-800 overflow-y-auto h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          {selectedObj.type === 'point' && <CircleDot className="w-4 h-4 text-purple-600" />}
          {selectedObj.type === 'line' && <TrendingUp className="w-4 h-4 text-blue-600" />}
          {selectedObj.type === 'rectangle' && <Square className="w-4 h-4 text-amber-600" />}
          {selectedObj.type === 'circle' && <Circle className="w-4 h-4 text-emerald-600" />}
          {selectedObj.type === 'arc' && <Compass className="w-4 h-4 text-cyan-600" />}

          <span className="font-bold text-sm text-slate-800 truncate">{selectedObj.name}</span>
        </div>

        <button
          onClick={() => deleteObject(selectedObj.id)}
          title="Удалить объект"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Common properties */}
      <div className="space-y-3">
        <div>
          <label className="text-slate-500 block mb-1 font-medium">Название объекта</label>
          <input
            type="text"
            value={selectedObj.name}
            onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80 shadow-sm">
          <span className="text-slate-700 font-medium">Отображать на схеме</span>
          <input
            type="checkbox"
            checked={selectedObj.visible !== false}
            onChange={(e) => updateObject(selectedObj.id, { visible: e.target.checked })}
            className="rounded border-slate-300 bg-white text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
          />
        </div>

        {/* Specialized properties by shape type */}
        {selectedObj.type === 'point' && (
          <PointProperties
            obj={selectedObj as PointHoleObject}
            onUpdate={(partial) => updateObject(selectedObj.id, partial)}
          />
        )}

        {selectedObj.type === 'line' && (
          <LineProperties
            obj={selectedObj as LineObject}
            onUpdate={(partial) => updateObject(selectedObj.id, partial)}
          />
        )}

        {selectedObj.type === 'rectangle' && (
          <RectangleProperties
            obj={selectedObj as RectangleObject}
            onUpdate={(partial) => updateObject(selectedObj.id, partial)}
          />
        )}

        {selectedObj.type === 'circle' && (
          <CircleProperties
            obj={selectedObj as CircleObject}
            onUpdate={(partial) => updateObject(selectedObj.id, partial)}
          />
        )}

        {selectedObj.type === 'arc' && (
          <ArcProperties
            obj={selectedObj as ArcObject}
            onUpdate={(partial) => updateObject(selectedObj.id, partial)}
          />
        )}
      </div>
    </div>
  );
};

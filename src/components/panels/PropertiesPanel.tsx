import React from 'react';
import { Circle, CircleDot, Compass, Sliders, Square, Trash2, TrendingUp } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { DrillMode } from '../../types';

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

        {/* 1. POINT / HOLE PROPERTIES */}
        {selectedObj.type === 'point' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Координата X (мм)</label>
                <input
                  type="number"
                  value={selectedObj.x}
                  onChange={(e) => updateObject(selectedObj.id, { x: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Координата Y (мм)</label>
                <input
                  type="number"
                  value={selectedObj.y}
                  onChange={(e) => updateObject(selectedObj.id, { y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Диаметр (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedObj.diameter}
                  onChange={(e) => updateObject(selectedObj.id, { diameter: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-purple-700 font-bold focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Глубина Z (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedObj.depth}
                  onChange={(e) => updateObject(selectedObj.id, { depth: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-500 block mb-1 font-medium">Режим сверления</label>
              <select
                value={
                  selectedObj.drillMode === '3mm' || selectedObj.drillMode === '3мм'
                    ? '3mm'
                    : selectedObj.drillMode === '9mm' || selectedObj.drillMode === '9мм'
                    ? '9mm'
                    : '11mm'
                }
                onChange={(e) => {
                  const mode = e.target.value as DrillMode;
                  const newDiameter = mode === '3mm' ? 3.0 : mode === '9mm' ? 9.0 : 11.0;
                  updateObject(selectedObj.id, {
                    drillMode: mode,
                    diameter: newDiameter,
                  });
                }}
                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-semibold focus:border-purple-500 focus:bg-white focus:outline-none transition-all"
              >
                <option value="11mm">11мм (Спиральное сверление 11мм - 2 прохода)</option>
                <option value="9mm">9мм (Спиральное сверление 9мм - 1 проход)</option>
                <option value="3mm">3мм (Точка в ДСП на глубину)</option>
              </select>
            </div>

            {/* Template Info Card */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-900 space-y-1 shadow-sm">
              <span className="font-bold text-purple-800 block">
                {selectedObj.drillMode === '3mm' || selectedObj.drillMode === '3мм'
                  ? 'Шаблон сверления 3мм:'
                  : selectedObj.drillMode === '9mm' || selectedObj.drillMode === '9мм'
                  ? 'Шаблон сверления 9мм:'
                  : 'Шаблон сверления 11мм:'}
              </span>
              <pre className="font-mono text-[10px] text-purple-800 bg-white/80 p-2 rounded-lg border border-purple-200 leading-relaxed overflow-x-auto shadow-inner">
                {selectedObj.drillMode === '3mm' || selectedObj.drillMode === '3мм'
                  ? `G00 X0.0 Y0.0 Z5.0
G01 Z-${selectedObj.depth || 5.0} F500.0
G00 Z5.0`
                  : selectedObj.drillMode === '9mm' || selectedObj.drillMode === '9мм'
                  ? `G00 X-0.5 Y0.0 Z5.0
G02 I0.5 J0.0 Z-33.0 F1000.0
G00 Z5.0`
                  : `G00 X-1.5 Y0.0 Z5.0
G02 I1.5 J0.0 Z-16.0 F1000.0
G02 I1.5 J0.0 Z-33.0
G00 Z5.0`}
              </pre>
            </div>
          </>
        )}

        {/* 2. LINE PROPERTIES */}
        {selectedObj.type === 'line' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Начало X1</label>
                <input
                  type="number"
                  value={selectedObj.startX}
                  onChange={(e) => updateObject(selectedObj.id, { startX: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Начало Y1</label>
                <input
                  type="number"
                  value={selectedObj.startY}
                  onChange={(e) => updateObject(selectedObj.id, { startY: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Конец X2</label>
                <input
                  type="number"
                  value={selectedObj.endX}
                  onChange={(e) => updateObject(selectedObj.id, { endX: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Конец Y2</label>
                <input
                  type="number"
                  value={selectedObj.endY}
                  onChange={(e) => updateObject(selectedObj.id, { endY: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-500 block mb-1">Глубина резания Z (мм)</label>
              <input
                type="number"
                step="0.5"
                value={selectedObj.depth}
                onChange={(e) => updateObject(selectedObj.id, { depth: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
              />
            </div>
          </>
        )}

        {/* 3. RECTANGLE PROPERTIES */}
        {selectedObj.type === 'rectangle' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Позиция X</label>
                <input
                  type="number"
                  value={selectedObj.x}
                  onChange={(e) => updateObject(selectedObj.id, { x: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Позиция Y</label>
                <input
                  type="number"
                  value={selectedObj.y}
                  onChange={(e) => updateObject(selectedObj.id, { y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Ширина (X)</label>
                <input
                  type="number"
                  step="1"
                  value={selectedObj.width}
                  onChange={(e) => updateObject(selectedObj.id, { width: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-amber-700 font-bold focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Высота (Y)</label>
                <input
                  type="number"
                  step="1"
                  value={selectedObj.height}
                  onChange={(e) => updateObject(selectedObj.id, { height: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-amber-700 font-bold focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-500 block mb-1">Глубина резания Z (мм)</label>
              <input
                type="number"
                step="0.5"
                value={selectedObj.depth}
                onChange={(e) => updateObject(selectedObj.id, { depth: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
              />
            </div>
          </>
        )}

        {/* 4. CIRCLE PROPERTIES */}
        {selectedObj.type === 'circle' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Центр X</label>
                <input
                  type="number"
                  value={selectedObj.centerX}
                  onChange={(e) => updateObject(selectedObj.id, { centerX: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Центр Y</label>
                <input
                  type="number"
                  value={selectedObj.centerY}
                  onChange={(e) => updateObject(selectedObj.id, { centerY: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Радиус R (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedObj.radius}
                  onChange={(e) => updateObject(selectedObj.id, { radius: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-emerald-700 font-bold focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Глубина Z (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedObj.depth}
                  onChange={(e) => updateObject(selectedObj.id, { depth: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>
          </>
        )}

        {/* 5. ARC PROPERTIES */}
        {selectedObj.type === 'arc' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Начало X1 (мм)</label>
                <input
                  type="number"
                  value={selectedObj.startX}
                  onChange={(e) => updateObject(selectedObj.id, { startX: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-emerald-700 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Начало Y1 (мм)</label>
                <input
                  type="number"
                  value={selectedObj.startY}
                  onChange={(e) => updateObject(selectedObj.id, { startY: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-emerald-700 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Конец X2 (мм)</label>
                <input
                  type="number"
                  value={selectedObj.endX}
                  onChange={(e) => updateObject(selectedObj.id, { endX: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-rose-700 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Конец Y2 (мм)</label>
                <input
                  type="number"
                  value={selectedObj.endY}
                  onChange={(e) => updateObject(selectedObj.id, { endY: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-rose-700 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Центр Xc (мм)</label>
                <input
                  type="number"
                  value={selectedObj.centerX}
                  onChange={(e) => updateObject(selectedObj.id, { centerX: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-cyan-700 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Центр Yc (мм)</label>
                <input
                  type="number"
                  value={selectedObj.centerY}
                  onChange={(e) => updateObject(selectedObj.id, { centerY: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-cyan-700 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-1">Радиус R (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedObj.radius}
                  onChange={(e) => updateObject(selectedObj.id, { radius: Math.max(0.1, parseFloat(e.target.value) || 1) })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-amber-700 font-bold focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Глубина Z (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedObj.depth}
                  onChange={(e) => updateObject(selectedObj.id, { depth: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-500 block mb-1 font-medium">Направление дуги</label>
              <button
                type="button"
                onClick={() => updateObject(selectedObj.id, { clockwise: !selectedObj.clockwise })}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-2 shadow-sm ${
                  selectedObj.clockwise
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-800 hover:bg-cyan-100'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span>{selectedObj.clockwise ? '↻ По часовой стрелке (G02)' : '↺ Против часовой стрелки (G03)'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

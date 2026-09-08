import React from 'react';
import { Circle, CircleDot, Layers, Ruler, Sliders, Spline, Square, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { ArcObject, CircleObject, LineObject, PointHoleObject, RectangleObject } from '../../types';
import { LineDotRightHorizontal } from '../icons/LineDotRightHorizontal';
import { ArcProperties } from './properties/ArcProperties';
import { CircleProperties } from './properties/CircleProperties';
import { LineProperties } from './properties/LineProperties';
import { PointProperties } from './properties/PointProperties';
import { RectangleProperties } from './properties/RectangleProperties';

export const PropertiesPanel: React.FC = () => {
  const {
    selectedObjectId,
    selectedObjectIds,
    objects,
    updateObject,
    updateSelectedObjects,
    deleteObject,
    deleteSelectedObjects,
    activeTool,
    liveEdit,
    liveMeasure,
  } = useProjectStore();

  // ── Линейка / штангенциркуль: живой замер вместо плавающего окна ──
  if (activeTool === 'measure') {
    let body: React.ReactNode;
    if (liveMeasure) {
      const dx = liveMeasure.end.x - liveMeasure.start.x;
      const dy = liveMeasure.end.y - liveMeasure.start.y;
      const len = Math.hypot(dx, dy);
      const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      body = (
        <div className="space-y-3">
          <div>
            <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">Расстояние</span>
            <div className="font-mono text-3xl font-bold text-slate-800">
              {len.toFixed(3)} <span className="text-sm font-normal text-slate-400">мм</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-100/70 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 block">dX</span>
              <span className="font-mono text-sm font-bold text-slate-700">{dx >= 0 ? '+' : ''}{dx.toFixed(2)}</span>
            </div>
            <div className="bg-slate-100/70 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 block">dY</span>
              <span className="font-mono text-sm font-bold text-slate-700">{dy >= 0 ? '+' : ''}{dy.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-slate-100/70 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">Угол</span>
            <span className="font-mono text-sm font-bold text-slate-700">{angleDeg.toFixed(1)}°</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {liveMeasure.end.x === liveMeasure.start.x && liveMeasure.end.y === liveMeasure.start.y
              ? 'Укажите вторую точку на холсте.'
              : 'Значения обновляются на лету.'}
          </p>
        </div>
      );
    } else {
      body = <p className="text-[11px] text-slate-400">Укажите первую точку линейки на холсте.</p>;
    }

    return (
      <div className="p-4 space-y-3 text-xs text-slate-800 overflow-y-auto h-full select-none">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
          <Ruler className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-sm text-slate-800">Линейка</span>
        </div>
        {body}
      </div>
    );
  }

  const selectedObjs = objects.filter((o) => selectedObjectIds.includes(o.id));

  if (selectedObjectIds.length > 1) {
    const allVisible = selectedObjs.every((o) => o.visible !== false);

    return (
      <div className="p-4 space-y-4 text-xs text-slate-800 overflow-y-auto h-full select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-800 block">Группа объектов</span>
              <span className="text-[11px] text-slate-500">Выбрано: {selectedObjectIds.length}</span>
            </div>
          </div>

          <button
            onClick={deleteSelectedObjects}
            title="Удалить выбранные объекты"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80 shadow-sm">
            <span className="text-slate-700 font-medium">Отображать на схеме</span>
            <input
              type="checkbox"
              checked={allVisible}
              onChange={(e) => updateSelectedObjects({ visible: e.target.checked })}
              className="rounded border-slate-300 bg-white text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
            />
          </div>

          {/* Group summary */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <span className="text-slate-500 font-medium block text-[11px] uppercase tracking-wider">
              Состав выделения:
            </span>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {selectedObjs.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-white border border-slate-200/60"
                >
                  <span className="font-medium text-slate-700 truncate">{o.name}</span>
                  <span className="text-slate-400 uppercase text-[10px]">{o.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const committedObj = objects.find((o) => o.id === selectedObjectId);

  if (!committedObj) {
    return (
      <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-full gap-2 select-none">
        <Sliders className="w-8 h-8 opacity-40 text-slate-400" />
        <p>Выберите объект на холсте или рамкой выделения для просмотра и редактирования его свойств.</p>
      </div>
    );
  }

  // Overlay the live drag patch so the coordinate fields track the cursor while a
  // vertex handle is being dragged (the store commits only on mouseup).
  const selectedObj =
    liveEdit && liveEdit.id === committedObj.id
      ? ({ ...committedObj, ...liveEdit.patch } as typeof committedObj)
      : committedObj;

  const lineInfo =
    selectedObj.type === 'line'
      ? (() => {
          const l = selectedObj as LineObject;
          const len = Math.hypot(l.endX - l.startX, l.endY - l.startY);
          const angleDeg = ((Math.atan2(l.endY - l.startY, l.endX - l.startX) * 180) / Math.PI + 360) % 360;
          return { len, angleDeg };
        })()
      : null;

  return (
    <div className="p-4 space-y-4 text-xs text-slate-800 overflow-y-auto h-full select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          {selectedObj.type === 'point' && <CircleDot className="w-4 h-4 text-purple-600" />}
          {selectedObj.type === 'line' && <LineDotRightHorizontal className="w-4 h-4 text-blue-600" />}
          {selectedObj.type === 'rectangle' && <Square className="w-4 h-4 text-amber-600" />}
          {selectedObj.type === 'circle' && <Circle className="w-4 h-4 text-emerald-600" />}
          {selectedObj.type === 'arc' && <Spline className="w-4 h-4 text-cyan-600" />}

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

        {/* Live length / angle readout for a segment */}
        {lineInfo && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 font-mono text-xs">
            <span className="text-slate-500">Длина</span>
            <span className="font-bold text-amber-700">{lineInfo.len.toFixed(2)} мм</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Угол</span>
            <span className="font-bold text-sky-700">{lineInfo.angleDeg.toFixed(1)}°</span>
          </div>
        )}

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

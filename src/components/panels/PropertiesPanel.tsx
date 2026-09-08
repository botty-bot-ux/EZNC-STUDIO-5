import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Circle, CircleDot, Eye, EyeOff, Layers, LineDotRightHorizontal, Lock, Move, Ruler, Sliders, Spline, Square, Trash2, Unlock } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { ArcObject, CircleObject, LineObject, PointHoleObject, RectangleObject } from '../../types';
import { ArcProperties } from './properties/ArcProperties';
import { CircleProperties } from './properties/CircleProperties';
import { LineProperties } from './properties/LineProperties';
import { PointProperties } from './properties/PointProperties';
import { RectangleProperties } from './properties/RectangleProperties';
import { MoveDialog } from '../modals/MoveDialog';

export const PropertiesPanel: React.FC = () => {
  const {
    selectedObjectId,
    selectedObjectIds,
    objects,
    updateObject,
    updateSelectedObjects,
    deleteObject,
    deleteSelectedObjects,
    moveSelectedObjectsBy,
    activeTool,
    liveEdit,
    liveMeasure,
  } = useProjectStore(
    useShallow((s) => ({
      selectedObjectId: s.selectedObjectId,
      selectedObjectIds: s.selectedObjectIds,
      objects: s.objects,
      updateObject: s.updateObject,
      updateSelectedObjects: s.updateSelectedObjects,
      deleteObject: s.deleteObject,
      deleteSelectedObjects: s.deleteSelectedObjects,
      moveSelectedObjectsBy: s.moveSelectedObjectsBy,
      activeTool: s.activeTool,
      liveEdit: s.liveEdit,
      liveMeasure: s.liveMeasure,
    }))
  );

  const [moveOpen, setMoveOpen] = React.useState(false);

  // ── Линейка / штангенциркуль: живой замер вместо плавающего окна ──
  if (activeTool === 'measure') {
    let body: React.ReactNode;
    if (liveMeasure) {
      body = (
        <p className="text-[13px] text-slate-400 dark:text-slate-500">
          Длина, смещения dX/dY и угол показываются на холсте.
        </p>
      );
    } else {
      body = <p className="text-[13px] text-slate-400 dark:text-slate-500">Укажите первую точку линейки на холсте.</p>;
    }

    return (
      <div className="p-4 space-y-3 text-xs text-slate-800 dark:text-slate-100 overflow-y-auto h-full select-none">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-700/80">
          <Ruler className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Линейка</span>
        </div>
        {body}
      </div>
    );
  }

  const selectedObjs = objects.filter((o) => selectedObjectIds.includes(o.id));

  if (selectedObjectIds.length > 1) {
    const allVisible = selectedObjs.every((o) => o.visible !== false);
    const allFrozen = selectedObjs.every((o) => o.frozen === true);

    return (
      <div className="p-4 space-y-4 text-xs text-slate-800 dark:text-slate-100 overflow-y-auto h-full select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 block">Группа объектов</span>
              <span className="text-[13px] text-slate-500 dark:text-slate-400">Выбрано: {selectedObjectIds.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => updateSelectedObjects({ visible: !allVisible })}
              title={allVisible ? 'Скрыть выбранные фигуры' : 'Показать выбранные фигуры'}
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-all"
            >
              {allVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => updateSelectedObjects({ frozen: !allFrozen })}
              title={allFrozen ? 'Разморозить (разрешить перемещение)' : 'Заморозить (запретить случайное перемещение)'}
              className={`p-1.5 rounded-lg transition-all ${
                allFrozen
                  ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/20 hover:bg-sky-100 hover:dark:bg-sky-500/30'
                  : 'text-slate-400 dark:text-slate-500 hover:text-sky-600 hover:dark:text-sky-400 hover:bg-sky-50 hover:dark:bg-sky-500/20'
              }`}
            >
              {allFrozen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            {!allFrozen && (
              <button
                onClick={() => setMoveOpen(true)}
                title="Переместить (точное смещение по X/Y)"
                className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-sky-600 hover:dark:text-sky-400 hover:bg-sky-50 hover:dark:bg-sky-500/20 transition-all"
              >
                <Move className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={deleteSelectedObjects}
              title="Удалить выбранные объекты"
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:dark:text-rose-400 hover:bg-rose-50 hover:dark:bg-rose-500/20 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Group summary */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium block text-xs">
              Состав выделения:
            </span>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {selectedObjs.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between text-[13px] p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{o.name}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs">{o.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <MoveDialog
          isOpen={moveOpen}
          ids={selectedObjs.filter((o) => !o.frozen).map((o) => o.id)}
          onClose={() => setMoveOpen(false)}
          onApply={moveSelectedObjectsBy}
        />
      </div>
    );
  }

  const committedObj = objects.find((o) => o.id === selectedObjectId);

  if (!committedObj) {
    return (
      <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center justify-center h-full gap-2 select-none">
        <Sliders className="w-8 h-8 opacity-40 text-slate-400 dark:text-slate-500" />
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
    <div className="p-4 space-y-4 text-xs text-slate-800 dark:text-slate-100 overflow-y-auto h-full select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
        <div className="flex items-center gap-2">
          {selectedObj.type === 'point' && <CircleDot className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
          {selectedObj.type === 'line' && <LineDotRightHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          {selectedObj.type === 'rectangle' && <Square className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          {selectedObj.type === 'circle' && <Circle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          {selectedObj.type === 'arc' && <Spline className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}

          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{selectedObj.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => updateObject(selectedObj.id, { visible: selectedObj.visible === false })}
            title={selectedObj.visible !== false ? 'Скрыть фигуру' : 'Показать фигуру'}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-all"
          >
            {selectedObj.visible !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => updateObject(selectedObj.id, { frozen: selectedObj.frozen !== true })}
            title={selectedObj.frozen === true ? 'Разморозить (разрешить перемещение)' : 'Заморозить (запретить случайное перемещение)'}
            className={`p-1.5 rounded-lg transition-all ${
              selectedObj.frozen === true
                ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/20 hover:bg-sky-100 hover:dark:bg-sky-500/30'
                : 'text-slate-400 dark:text-slate-500 hover:text-sky-600 hover:dark:text-sky-400 hover:bg-sky-50 hover:dark:bg-sky-500/20'
            }`}
          >
            {selectedObj.frozen === true ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          {!selectedObj.frozen && (
            <button
              onClick={() => setMoveOpen(true)}
              title="Переместить (точное смещение по X/Y)"
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-sky-600 hover:dark:text-sky-400 hover:bg-sky-50 hover:dark:bg-sky-500/20 transition-all"
            >
              <Move className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => deleteObject(selectedObj.id)}
            title="Удалить объект"
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:dark:text-rose-400 hover:bg-rose-50 hover:dark:bg-rose-500/20 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Common properties */}
      <div className="space-y-3">
        <div>
          <label className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Название объекта</label>
          <input
            type="text"
            value={selectedObj.name}
            onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all"
          />
        </div>

        {/* Live length / angle readout for a segment */}
        {lineInfo && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-500/15 border border-amber-200/80 font-mono text-xs">
            <span className="text-slate-500 dark:text-slate-400">Длина</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">{lineInfo.len.toFixed(2)} мм</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-500 dark:text-slate-400">Угол</span>
            <span className="font-bold text-sky-700 dark:text-sky-400">{lineInfo.angleDeg.toFixed(1)}°</span>
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

      <MoveDialog
        isOpen={moveOpen}
        ids={[selectedObj.id]}
        onClose={() => setMoveOpen(false)}
        onApply={moveSelectedObjectsBy}
      />
    </div>
  );
};

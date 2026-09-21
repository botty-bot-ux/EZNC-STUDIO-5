import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Circle, CircleDot, Eye, EyeOff, GitCompareArrows, Layers, LineDotRightHorizontal, Lock, Move, Ruler, Sliders, Spline, Square, Trash2, Unlock } from 'lucide-react';
import { useProjectStore, useSelectedObjectId } from '../../store/useProjectStore';
import { ArcObject, CircleObject, LineObject, PointHoleObject, RectangleObject } from '../../types';
import { ArcProperties } from './properties/ArcProperties';
import { CircleProperties } from './properties/CircleProperties';
import { LineProperties } from './properties/LineProperties';
import { PointProperties } from './properties/PointProperties';
import { RectangleProperties } from './properties/RectangleProperties';

interface SelectionActionsProps {
  /** Все выбранные видимы (кнопка Глаза). */
  showing: boolean;
  /** Все выбранные заморожены (кнопка Замка). */
  frozen: boolean;
  /** Формулировки «фигура» vs «фигуры» для title. */
  plural: boolean;
  onToggleVisible: () => void;
  onToggleFrozen: () => void;
  onMove: () => void;
  onDelete: () => void;
  /** Кнопка «Параллельная линия/дуга» — только для одиночной линии/дуги. */
  parallel?: { title: string; onClick: () => void };
}

const SelectionActions: React.FC<SelectionActionsProps> = ({
  showing,
  frozen,
  plural,
  onToggleVisible,
  onToggleFrozen,
  onMove,
  onDelete,
  parallel,
}) => (
  <div className="flex items-center gap-1">
    <button
      onClick={onToggleVisible}
      title={showing ? (plural ? 'Скрыть выбранные фигуры' : 'Скрыть фигуру') : plural ? 'Показать выбранные фигуры' : 'Показать фигуру'}
      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-all"
    >
      {showing ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
    </button>
    <button
      onClick={onToggleFrozen}
      title={frozen ? 'Разморозить (разрешить перемещение)' : 'Заморозить (запретить случайное перемещение)'}
      className={`p-1.5 rounded-lg transition-all ${
        frozen
          ? 'text-primary bg-primary/10 hover:bg-primary/15'
          : 'text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-slate-100 hover:dark:bg-slate-700'
      }`}
    >
      {frozen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
    </button>
    {!frozen && (
      <button
        onClick={onMove}
        title="Переместить (точное смещение по X/Y)"
        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-slate-100 hover:dark:bg-slate-700 transition-all"
      >
        <Move className="w-4 h-4" />
      </button>
    )}
    {parallel && (
      <button
        onClick={parallel.onClick}
        title={parallel.title}
        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-slate-100 hover:dark:bg-slate-700 transition-all"
      >
        <GitCompareArrows className="w-4 h-4" />
      </button>
    )}
    <button
      onClick={onDelete}
      title={plural ? 'Удалить выбранные объекты' : 'Удалить объект'}
      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-danger hover:bg-danger/10 transition-all"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

export const PropertiesPanel: React.FC = () => {
  const {
    selectedObjectIds,
    objects,
    updateObject,
    updateSelectedObjects,
    deleteObject,
    deleteSelectedObjects,
    activeTool,
    liveEdit,
    liveMeasure,
    setShapeDialog,
  } = useProjectStore(
    useShallow((s) => ({
      selectedObjectIds: s.selectedObjectIds,
      objects: s.objects,
      updateObject: s.updateObject,
      updateSelectedObjects: s.updateSelectedObjects,
      deleteObject: s.deleteObject,
      deleteSelectedObjects: s.deleteSelectedObjects,
      activeTool: s.activeTool,
      liveEdit: s.liveEdit,
      liveMeasure: s.liveMeasure,
      setShapeDialog: s.setShapeDialog,
    }))
  );
  // «Основная» фигура — производная от selectedObjectIds (последний id).
  const selectedObjectId = useSelectedObjectId();

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
          <Ruler className="w-4 h-4 text-accent" />
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
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-accent font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 block">Группа объектов</span>
              <span className="text-[13px] text-slate-500 dark:text-slate-400">Выбрано: {selectedObjectIds.length}</span>
            </div>
          </div>

          <SelectionActions
            showing={allVisible}
            frozen={allFrozen}
            plural
            onToggleVisible={() => updateSelectedObjects({ visible: !allVisible })}
            onToggleFrozen={() => updateSelectedObjects({ frozen: !allFrozen })}
            onMove={() => setShapeDialog({ kind: 'move' })}
            onDelete={deleteSelectedObjects}
          />
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
          {selectedObj.type === 'point' && <CircleDot className="w-4 h-4 text-accent" />}
          {selectedObj.type === 'line' && <LineDotRightHorizontal className="w-4 h-4 text-accent" />}
          {selectedObj.type === 'rectangle' && <Square className="w-4 h-4 text-accent" />}
          {selectedObj.type === 'circle' && <Circle className="w-4 h-4 text-accent" />}
          {selectedObj.type === 'arc' && <Spline className="w-4 h-4 text-accent" />}

          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{selectedObj.name}</span>
        </div>

        <SelectionActions
          showing={selectedObj.visible !== false}
          frozen={selectedObj.frozen === true}
          plural={false}
          onToggleVisible={() => updateObject(selectedObj.id, { visible: selectedObj.visible === false })}
          onToggleFrozen={() => updateObject(selectedObj.id, { frozen: selectedObj.frozen !== true })}
          onMove={() => setShapeDialog({ kind: 'move' })}
          onDelete={() => deleteObject(selectedObj.id)}
          parallel={
            selectedObj.type === 'line' || selectedObj.type === 'arc'
              ? {
                  title:
                    selectedObj.type === 'arc'
                      ? 'Параллельная дуга (концентрическое смещение)'
                      : 'Параллельная линия (смещение по нормали)',
                  onClick: () => setShapeDialog({ kind: 'parallel' }),
                }
              : undefined
          }
        />
      </div>

      {/* Common properties */}
      <div className="space-y-3">
        <div>
          <label className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Название объекта</label>
          <input
            type="text"
            value={selectedObj.name}
            onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-100 focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all"
          />
        </div>

        {/* Live length / angle readout for a segment */}
        {lineInfo && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-line font-mono text-xs">
            <span className="text-slate-500 dark:text-slate-400">Длина</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{lineInfo.len.toFixed(2)} мм</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-500 dark:text-slate-400">Угол</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{lineInfo.angleDeg.toFixed(1)}°</span>
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

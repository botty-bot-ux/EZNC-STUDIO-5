import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Compass,
  Copy,
  CircleDot,
  Eye,
  EyeOff,
  Layers,
  MousePointer,
  Square,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { OptimizationModal } from '../modals/OptimizationModal';
import { OptimizationResult } from '../../lib/geometry/optimizer';

export const LeftToolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    objects,
    selectedObjectId,
    setSelectedObjectId,
    deleteObject,
    duplicateObject,
    updateObject,
    reorderObjects,
    optimizeRoute,
  } = useProjectStore();

  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [isOptModalOpen, setIsOptModalOpen] = useState(false);

  const handleOptimizeClick = () => {
    const res = optimizeRoute();
    if (res) {
      setOptResult(res);
      setIsOptModalOpen(true);
    } else {
      alert('Нет объектов для оптимизации.');
    }
  };

  const moveObjectUp = (idx: number) => {
    if (idx <= 0) return;
    const newObjs = [...objects];
    const temp = newObjs[idx];
    newObjs[idx] = newObjs[idx - 1];
    newObjs[idx - 1] = temp;
    reorderObjects(newObjs);
  };

  const moveObjectDown = (idx: number) => {
    if (idx >= objects.length - 1) return;
    const newObjs = [...objects];
    const temp = newObjs[idx];
    newObjs[idx] = newObjs[idx + 1];
    newObjs[idx + 1] = temp;
    reorderObjects(newObjs);
  };

  const toggleAllVisibility = () => {
    const allVisible = objects.every((o) => o.visible !== false);
    objects.forEach((o) => updateObject(o.id, { visible: !allVisible }));
  };

  return (
    <aside className="w-80 bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl shadow-sky-500/5 text-slate-800 flex flex-col h-full select-none shrink-0 overflow-hidden">
      {/* 1. DRAWING TOOLBAR */}
      <div className="p-3 border-b border-slate-200/80 shrink-0">
        <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-2">
          Инструменты Рисования
        </span>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 shadow-inner">
          <button
            onClick={() => setActiveTool('select')}
            title="Выбор и перемещение (S)"
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
              activeTool === 'select'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MousePointer className="w-4 h-4" />
            <span>Выбор</span>
          </button>

          <button
            onClick={() => setActiveTool('point')}
            title="Отверстие / Точка (H)"
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
              activeTool === 'point'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <CircleDot className="w-4 h-4 text-purple-600" />
            <span>Отверстие</span>
          </button>

          <button
            onClick={() => setActiveTool('line')}
            title="Линия / Отрезок (L)"
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
              activeTool === 'line'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Отрезок</span>
          </button>

          <button
            onClick={() => setActiveTool('rectangle')}
            title="Прямоугольник (R)"
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
              activeTool === 'rectangle'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Square className="w-4 h-4 text-amber-600" />
            <span>Прямоуг.</span>
          </button>

          <button
            onClick={() => setActiveTool('circle')}
            title="Окружность (C)"
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
              activeTool === 'circle'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Circle className="w-4 h-4 text-emerald-600" />
            <span>Окружность</span>
          </button>

          <button
            onClick={() => setActiveTool('arc')}
            title="Дуга окружности (A)"
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
              activeTool === 'arc'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-600" />
            <span>Дуга</span>
          </button>
        </div>
      </div>

      {/* 2. OBJECTS MODULE WITH VISIBILITY CHECKBOXES */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/40">
        <div className="p-3 bg-white/50 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              ОБЪЕКТЫ ({objects.length})
            </span>
          </div>

          {objects.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleOptimizeClick}
                title="Оптимизировать маршрут резки"
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-lg transition-all cursor-pointer shadow-sm"
              >
                <Zap className="w-3 h-3 fill-amber-600 text-amber-600" />
                <span>Оптимизация</span>
              </button>

              <button
                onClick={toggleAllVisibility}
                title="Переключить видимость всех объектов"
                className="text-[11px] font-medium text-slate-600 hover:text-blue-600 flex items-center gap-1 bg-slate-200/70 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-colors"
              >
                <Eye className="w-3 h-3" />
                <span>Все</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {objects.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 italic">
              Нет объектов. Нажмите кнопку выше или нарисуйте фигуру на холсте.
            </div>
          ) : (
            objects.map((obj, idx) => {
              const isSelected = obj.id === selectedObjectId;
              const isVisible = obj.visible !== false;

              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={`group px-2.5 py-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold shadow-sm'
                      : isVisible
                      ? 'bg-white/80 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300 shadow-sm'
                      : 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-1 min-w-0">
                    {/* Reorder Up/Down arrows */}
                    <div className="flex flex-col text-slate-400 hover:text-slate-600 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveObjectUp(idx);
                        }}
                        disabled={idx === 0}
                        title="Переместить выше"
                        className="p-0.5 hover:text-blue-600 disabled:opacity-20 disabled:hover:text-slate-400"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveObjectDown(idx);
                        }}
                        disabled={idx === objects.length - 1}
                        title="Переместить ниже"
                        className="p-0.5 hover:text-blue-600 disabled:opacity-20 disabled:hover:text-slate-400"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* VISIBILITY CHECKBOX */}
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateObject(obj.id, { visible: !isVisible });
                      }}
                      title={isVisible ? 'Видим (нажмите, чтобы скрыть)' : 'Скрыт (нажмите, чтобы показать)'}
                      className="rounded border-slate-300 bg-white text-blue-600 focus:ring-0 cursor-pointer shrink-0 w-3.5 h-3.5"
                    />

                    {/* Shape Icon */}
                    {obj.type === 'point' && <CircleDot className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                    {obj.type === 'line' && <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    {obj.type === 'rectangle' && <Square className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    {obj.type === 'circle' && <Circle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {obj.type === 'arc' && <Compass className="w-3.5 h-3.5 text-cyan-600 shrink-0" />}

                    {/* Name */}
                    <span className={`truncate ${!isVisible ? 'line-through text-slate-400' : ''}`}>
                      {obj.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateObject(obj.id, { visible: !isVisible });
                      }}
                      title={isVisible ? 'Скрыть объект' : 'Показать объект'}
                      className="p-1 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-200/50"
                    >
                      {isVisible ? (
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateObject(obj.id);
                        }}
                        title="Дублировать"
                        className="p-1 hover:text-amber-700 text-slate-500 rounded-lg hover:bg-slate-200/50"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteObject(obj.id);
                        }}
                        title="Удалить"
                        className="p-1 hover:text-rose-600 text-slate-500 rounded-lg hover:bg-slate-200/50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <OptimizationModal
        isOpen={isOptModalOpen}
        onClose={() => setIsOptModalOpen(false)}
        result={optResult}
      />
    </aside>
  );
};

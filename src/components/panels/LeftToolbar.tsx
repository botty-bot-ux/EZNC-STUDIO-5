import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Circle,
  Compass,
  Copy,
  CircleDot,
  Eye,
  EyeOff,
  Layers,
  Square,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

export const LeftToolbar: React.FC = () => {
  const {
    objects,
    selectedObjectId,
    setSelectedObjectId,
    deleteObject,
    duplicateObject,
    updateObject,
    reorderObjects,
    leftPanelOpen,
    toggleLeftPanel,
  } = useProjectStore();

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

  return (
    <div className="absolute left-4 top-4 z-20 flex flex-col items-start select-none pointer-events-none">
      {/* Кнопка слоев всегда видна, переключает состояние */}
      <button
        onClick={toggleLeftPanel}
        title={leftPanelOpen ? "Скрыть слои" : "Показать слои"}
        className={`pointer-events-auto w-11 h-11 rounded-2xl shadow-2xl shadow-slate-900/15 flex items-center justify-center cursor-pointer border transition-all duration-200 hover:scale-105 active:scale-95 ${
          leftPanelOpen
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-white/90 backdrop-blur-2xl border-white/90 text-slate-700 hover:bg-white'
        }`}
      >
        <Layers className="w-5 h-5" />
      </button>

      {/* Список слоев прямо под кнопкой */}
      <AnimatePresence>
        {leftPanelOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            className="pointer-events-auto mt-2 w-80 max-h-[calc(100vh-160px)] overflow-y-auto flex flex-col gap-1.5 custom-scrollbar select-none p-3 pb-8"
          >
            {objects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 text-center text-xs text-slate-500 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl shadow-slate-900/10"
              >
                Слои отсутствуют. Добавьте фигуру на холст.
              </motion.div>
            ) : (
              <AnimatePresence initial={false}>
                {objects.map((obj, idx) => {
                  const isSelected = obj.id === selectedObjectId;
                  const isVisible = obj.visible !== false;

                  return (
                    <motion.div
                      key={obj.id}
                      layout
                      initial={{ opacity: 0, y: 5, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      onClick={() => setSelectedObjectId(obj.id)}
                      className={`group px-3 py-2.5 rounded-2xl border text-xs flex items-center justify-between cursor-pointer transition-all shadow-xl shadow-slate-900/10 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20 shadow-md font-semibold'
                          : isVisible
                          ? 'bg-white/90 backdrop-blur-md hover:bg-white border-slate-200/60 text-slate-700 hover:shadow-md'
                          : 'bg-white/50 backdrop-blur-sm border-slate-200/40 text-slate-400 opacity-60 hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-1 min-w-0">
                        {/* Reorder Up/Down arrows */}
                        <div
                          className={`flex flex-col shrink-0 ${
                            isSelected ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveObjectUp(idx);
                            }}
                            disabled={idx === 0}
                            title="Переместить выше"
                            className="p-0.5 hover:scale-110 disabled:opacity-20 disabled:hover:scale-100 transition-transform"
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
                            className="p-0.5 hover:scale-110 disabled:opacity-20 disabled:hover:scale-100 transition-transform"
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
                          title={isVisible ? 'Скрыть слой' : 'Показать слой'}
                          className={`rounded border-slate-300 focus:ring-0 cursor-pointer shrink-0 w-3.5 h-3.5 ${
                            isSelected ? 'accent-white' : 'accent-blue-600'
                          }`}
                        />

                        {/* Shape Icon */}
                        {obj.type === 'point' && (
                          <CircleDot
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-purple-200' : 'text-purple-600'
                            }`}
                          />
                        )}
                        {obj.type === 'line' && (
                          <TrendingUp
                            className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-100' : 'text-blue-600'}`}
                          />
                        )}
                        {obj.type === 'rectangle' && (
                          <Square
                            className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-200' : 'text-amber-600'}`}
                          />
                        )}
                        {obj.type === 'circle' && (
                          <Circle
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-emerald-200' : 'text-emerald-600'
                            }`}
                          />
                        )}
                        {obj.type === 'arc' && (
                          <Compass
                            className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-200' : 'text-cyan-600'}`}
                          />
                        )}

                        {/* Name */}
                        <span className={`truncate ${!isVisible ? 'line-through opacity-70' : ''}`}>
                          {obj.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateObject(obj.id, { visible: !isVisible });
                          }}
                          title={isVisible ? 'Скрыть слой' : 'Показать слой'}
                          className={`p-1 rounded-lg transition-colors ${
                            isSelected
                              ? 'text-white/80 hover:text-white hover:bg-white/20'
                              : 'text-slate-400 hover:text-blue-600 hover:bg-slate-200/50'
                          }`}
                        >
                          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateObject(obj.id);
                            }}
                            title="Дублировать"
                            className={`p-1 rounded-lg transition-colors ${
                              isSelected
                                ? 'text-white/80 hover:text-white hover:bg-white/20'
                                : 'text-slate-400 hover:text-amber-600 hover:bg-slate-200/50'
                            }`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteObject(obj.id);
                            }}
                            title="Удалить"
                            className={`p-1 rounded-lg transition-colors ${
                              isSelected
                                ? 'text-white/80 hover:text-white hover:bg-white/20'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200/50'
                            }`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


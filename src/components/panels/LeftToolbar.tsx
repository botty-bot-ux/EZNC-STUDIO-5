import React, { useState, useEffect } from 'react';
import {
  Layers,
  ChevronLeft,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { LayerItemAccordion } from './LayerItemAccordion';

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

  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // Automatically expand accordion when selected object changes
  useEffect(() => {
    if (selectedObjectId && !expandedIds.includes(selectedObjectId)) {
      setExpandedIds((prev) => [...prev, selectedObjectId]);
    }
  }, [selectedObjectId]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleExpandAll = () => {
    if (expandedIds.length === objects.length) {
      setExpandedIds([]);
    } else {
      setExpandedIds(objects.map((o) => o.id));
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

  const allExpanded = objects.length > 0 && expandedIds.length === objects.length;

  if (!leftPanelOpen) {
    return (
      <div className="absolute left-4 top-4 z-20 flex items-center select-none pointer-events-auto">
        <button
          onClick={toggleLeftPanel}
          title="Показать слои и контуры"
          className="relative w-11 h-11 bg-white/90 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-2xl shadow-slate-900/15 flex items-center justify-center cursor-pointer hover:bg-white text-slate-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all"
        >
          <Layers className="w-5 h-5 text-blue-600" />
          {objects.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center border-2 border-white shadow-sm">
              {objects.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <aside className="absolute left-4 top-4 bottom-4 w-80 sm:w-88 md:w-96 flex flex-col bg-white/90 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-2xl shadow-slate-900/15 text-slate-800 z-20 select-none overflow-hidden transition-all duration-200">
      {/* Top Header */}
      <div className="px-3 py-2 bg-white/60 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Слои и Контуры
          </span>
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {objects.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Details / Expand All Icon Button */}
          {objects.length > 0 && (
            <button
              onClick={toggleExpandAll}
              title={allExpanded ? 'Свернуть все детали' : 'Раскрыть все детали'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 transition-colors"
            >
              {allExpanded ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
          )}

          <button
            onClick={toggleLeftPanel}
            title="Свернуть панель слоев"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer Scrollable Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5 custom-scrollbar bg-slate-50/40">
        {objects.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 h-full">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Layers className="w-5 h-5 opacity-50" />
            </div>
            <span>Слои отсутствуют.</span>
            <span className="text-[11px] text-slate-400">
              Добавьте фигуры с верхней панели или импортируйте DXF/G-код.
            </span>
          </div>
        ) : (
          objects.map((obj, idx) => {
            const isSelected = obj.id === selectedObjectId;
            const isExpanded = expandedIds.includes(obj.id);

            return (
              <LayerItemAccordion
                key={obj.id}
                obj={obj}
                index={idx}
                totalCount={objects.length}
                isSelected={isSelected}
                isExpanded={isExpanded}
                onSelect={() => setSelectedObjectId(obj.id)}
                onToggleExpand={() => toggleExpand(obj.id)}
                onMoveUp={() => moveObjectUp(idx)}
                onMoveDown={() => moveObjectDown(idx)}
                onDelete={() => deleteObject(obj.id)}
                onDuplicate={() => duplicateObject(obj.id)}
                onUpdate={(partial) => updateObject(obj.id, partial)}
              />
            );
          })
        )}
      </div>
    </aside>
  );
};




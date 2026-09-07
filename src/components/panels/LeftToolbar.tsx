import React from 'react';
import { ChevronLeft, Shapes } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { LayerItemAccordion } from './LayerItemAccordion';

// Левая панель — простой текстовый список фигур на прозрачном фоне.
// Выбранная фигура синим; её свойства (координаты, Ø, глубина) — на правой панели «Свойства».
export const LeftToolbar: React.FC = () => {
  const {
    objects,
    selectedObjectIds,
    setSelectedObjectId,
    toggleObjectSelection,
    deleteObject,
    duplicateObject,
    updateObject,
    reorderObjects,
    setActiveTab,
    leftPanelOpen,
    toggleLeftPanel,
  } = useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      setSelectedObjectId: s.setSelectedObjectId,
      toggleObjectSelection: s.toggleObjectSelection,
      deleteObject: s.deleteObject,
      duplicateObject: s.duplicateObject,
      updateObject: s.updateObject,
      reorderObjects: s.reorderObjects,
      setActiveTab: s.setActiveTab,
      leftPanelOpen: s.leftPanelOpen,
      toggleLeftPanel: s.toggleLeftPanel,
    }))
  );

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

  if (!leftPanelOpen) {
    return (
      <div className="absolute left-4 top-4 z-20 flex items-center select-none pointer-events-auto">
        <button
          onClick={toggleLeftPanel}
          title="Показать список фигур"
          className="relative w-11 h-11 bg-white/90 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-2xl shadow-slate-900/15 flex items-center justify-center cursor-pointer hover:bg-white text-slate-700 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all"
        >
          <Shapes className="w-5 h-5 text-blue-600" />
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
    <aside className="absolute left-4 top-4 bottom-4 w-72 flex flex-col bg-transparent text-slate-800 z-20 select-none overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="px-1.5 py-1 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Shapes className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Фигуры</span>
          <span className="text-[10px] font-bold text-slate-400">{objects.length}</span>
        </div>

        <button
          onClick={toggleLeftPanel}
          title="Свернуть панель"
          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-500/10 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Figures list */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1 space-y-0.5 custom-scrollbar">
        {objects.length === 0 ? (
          <div className="px-2 py-3 text-xs text-slate-500">
            Фигур нет. Добавьте с верхней панели или импортируйте DXF/G-код.
          </div>
        ) : (
          objects.map((obj, idx) => {
            const isSelected = selectedObjectIds.includes(obj.id);
            return (
              <LayerItemAccordion
                key={obj.id}
                obj={obj}
                index={idx}
                totalCount={objects.length}
                isSelected={isSelected}
                onSelect={(e) => {
                  if (e && (e.ctrlKey || e.shiftKey || e.metaKey)) {
                    toggleObjectSelection(obj.id);
                  } else {
                    setSelectedObjectId(obj.id);
                  }
                  setActiveTab('properties');
                }}
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

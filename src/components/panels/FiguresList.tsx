import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { LayerItemAccordion } from './LayerItemAccordion';

// Список фигур — общий контент для десктопной левой панели и мобильной шторки «Фигуры».
export const FiguresList: React.FC = () => {
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

  if (objects.length === 0) {
    return (
      <div className="px-3 py-3 text-xs text-slate-500">
        Фигур нет. Добавьте с верхней панели или импортируйте DXF/G-код.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto min-h-0 py-1 space-y-0.5 custom-scrollbar">
      {objects.map((obj, idx) => {
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
      })}
    </div>
  );
};

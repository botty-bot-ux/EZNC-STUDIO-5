import React from 'react';
import { LineDotRightHorizontal, Spline, CircleDot } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { isRailMachine } from '../../store/initialState';
import { LayerItemAccordion } from './LayerItemAccordion';

interface FiguresListProps {
  filterQuery?: string;
}

export const FiguresList: React.FC<FiguresListProps> = ({ filterQuery = '' }) => {
  const {
    objects,
    selectedObjectIds,
    simActiveLayerId,
    setSelectedObjectId,
    toggleObjectSelection,
    deleteObject,
    updateObject,
    reorderObjects,
    setActiveTab,
    setActiveTool,
    focusCanvasOnObject,
    machine,
  } = useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      simActiveLayerId: s.simActiveLayerId,
      setSelectedObjectId: s.setSelectedObjectId,
      toggleObjectSelection: s.toggleObjectSelection,
      deleteObject: s.deleteObject,
      updateObject: s.updateObject,
      reorderObjects: s.reorderObjects,
      setActiveTab: s.setActiveTab,
      setActiveTool: s.setActiveTool,
      focusCanvasOnObject: s.focusCanvasOnObject,
      machine: s.machine,
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

  const isRail = isRailMachine(machine);

  if (objects.length === 0) {
    return (
      <div className="p-4 flex flex-col justify-center h-full space-y-3 text-xs text-muted">
        <p className="leading-relaxed">
          Чертеж пуст. Добавьте геометрию инструментом черчения или загрузите готовый файл{' '}
          <span className="font-mono text-fg-secondary">.nc / .json</span>.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTool('line')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-subtle hover:bg-surface-hover border border-line text-fg text-xs font-medium transition-colors cursor-pointer"
          >
            <LineDotRightHorizontal className="w-3.5 h-3.5 text-muted" />
            <span>Линия (L)</span>
          </button>
          {isRail ? (
            <button
              type="button"
              onClick={() => setActiveTool('point')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-subtle hover:bg-surface-hover border border-line text-fg text-xs font-medium transition-colors cursor-pointer"
            >
              <CircleDot className="w-3.5 h-3.5 text-muted" />
              <span>Отверстие (H)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTool('arc')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-subtle hover:bg-surface-hover border border-line text-fg text-xs font-medium transition-colors cursor-pointer"
            >
              <Spline className="w-3.5 h-3.5 text-muted" />
              <span>Дуга (A)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const normalizedQuery = filterQuery.trim().toLowerCase();
  const visibleEntries = objects
    .map((obj, idx) => ({ obj, idx }))
    .filter(({ obj }) =>
      normalizedQuery ? obj.name.toLowerCase().includes(normalizedQuery) : true
    );

  if (visibleEntries.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted">
        Ничего не найдено по запросу «{filterQuery}».
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto min-h-0 p-1.5 space-y-0.5">
      {visibleEntries.map(({ obj, idx }) => {
        const isSelected = selectedObjectIds.includes(obj.id);
        return (
          <LayerItemAccordion
            key={obj.id}
            obj={obj}
            index={idx}
            totalCount={objects.length}
            isSelected={isSelected}
            isActive={simActiveLayerId === obj.id}
            onSelect={(e) => {
              if (e && (e.ctrlKey || e.shiftKey || e.metaKey)) {
                toggleObjectSelection(obj.id);
              } else {
                setSelectedObjectId(obj.id);
              }
              setActiveTab('properties');
            }}
            onDoubleClick={() => focusCanvasOnObject(obj.id)}
            onMoveUp={() => moveObjectUp(idx)}
            onMoveDown={() => moveObjectDown(idx)}
            onDelete={() => deleteObject(obj.id)}
            onUpdate={(partial) => updateObject(obj.id, partial)}
          />
        );
      })}
    </div>
  );
};

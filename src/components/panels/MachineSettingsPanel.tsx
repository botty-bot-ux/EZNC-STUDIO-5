import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { MachineBoundsSection } from './machine/MachineBoundsSection';
import { PresetAndStockSection } from './machine/PresetAndStockSection';
import { ToolAndFeedsSection } from './machine/ToolAndFeedsSection';
import { UnderlaySection } from './machine/UnderlaySection';

export const MachineSettingsPanel: React.FC = () => {
  const {
    machine,
    updateMachine,
    applyMachinePreset,
    underlay,
    setUnderlayImage,
    updateUnderlay,
    fitUnderlayToSheet,
    clearUnderlay,
    selectedObjectIds,
    objects,
    setActiveTab,
    selectAllObjects,
  } = useProjectStore(
    useShallow((s) => ({
      machine: s.machine,
      updateMachine: s.updateMachine,
      applyMachinePreset: s.applyMachinePreset,
      underlay: s.underlay,
      setUnderlayImage: s.setUnderlayImage,
      updateUnderlay: s.updateUnderlay,
      fitUnderlayToSheet: s.fitUnderlayToSheet,
      clearUnderlay: s.clearUnderlay,
      selectedObjectIds: s.selectedObjectIds,
      objects: s.objects,
      setActiveTab: s.setActiveTab,
      selectAllObjects: s.selectAllObjects,
    }))
  );

  const selectedCount = selectedObjectIds.length;
  const primarySelected =
    selectedCount === 1 ? objects.find((o) => o.id === selectedObjectIds[0]) : null;

  return (
    <div className="text-xs text-fg overflow-y-auto h-full select-none flex flex-col">
      {/* Липкая шапка инспектора листа и станка */}
      <div className="sticky top-0 z-10 px-3.5 py-2.5 bg-surface/95 backdrop-blur-sm border-b border-line flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-accent shrink-0" />
          <span className="font-semibold text-sm text-fg truncate">Лист и станок</span>
        </div>

        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            title="Вернуться к свойствам выделения"
            className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="max-w-[120px] truncate">
              {primarySelected ? primarySelected.name : `Выбрано: ${selectedCount}`}
            </span>
            <ArrowRight className="w-3 h-3 shrink-0" />
          </button>
        ) : (
          objects.length > 0 && (
            <button
              type="button"
              onClick={selectAllObjects}
              title="Выделить все фигуры на чертеже"
              className="text-[11px] font-medium text-muted hover:text-fg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Выделить все ({objects.length})
            </button>
          )
        )}
      </div>

      <div className="flex-1">
        <PresetAndStockSection
          machine={machine}
          onApplyPreset={applyMachinePreset}
          onUpdateMachine={updateMachine}
        />
        <ToolAndFeedsSection machine={machine} onUpdateMachine={updateMachine} />
        <MachineBoundsSection machine={machine} onUpdateMachine={updateMachine} />
        <UnderlaySection
          underlay={underlay}
          onSetImage={setUnderlayImage}
          onUpdate={updateUnderlay}
          onFitToSheet={fitUnderlayToSheet}
          onClear={clearUnderlay}
        />
      </div>
    </div>
  );
};

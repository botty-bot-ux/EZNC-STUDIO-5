import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { MachineSettings } from '../../../types';
import { InspectorSection } from '../../ui/InspectorSection';
import { NumericInput } from '../../ui/NumericInput';
import { BED_SIZE_PRESETS } from './stockSheetPresets';

const LABEL_CLS = 'text-[11px] text-muted block mb-1 font-medium';
const NUM_INPUT_CLS =
  'w-full bg-surface-subtle border border-line rounded-lg px-2.5 py-1.5 font-mono tabular-nums text-xs text-fg font-semibold focus:bg-surface focus:border-accent focus:outline-none transition-colors';
const NUM_INPUT_SM_CLS =
  'w-full bg-surface-subtle border border-line rounded-lg px-1.5 py-1.5 font-mono tabular-nums text-xs text-fg font-semibold focus:bg-surface focus:border-accent focus:outline-none transition-colors text-center';

interface MachineBoundsSectionProps {
  machine: MachineSettings;
  onUpdateMachine: (partial: Partial<MachineSettings>) => void;
}

export const MachineBoundsSection: React.FC<MachineBoundsSectionProps> = ({
  machine,
  onUpdateMachine,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { bounds } = machine;
  const bedWidthY = Math.round(Math.abs(bounds.yMax - bounds.yMin));
  const bedHeightX = Math.round(Math.abs(bounds.xMax - bounds.xMin));

  const setBedSize = (nextWidthY: number, nextHeightX: number) => {
    const safeW = Math.max(100, Math.round(nextWidthY));
    const safeH = Math.max(100, Math.round(nextHeightX));
    const yMax = Math.max(bounds.yMin, bounds.yMax);
    const xMax = Math.max(bounds.xMin, bounds.xMax);
    onUpdateMachine({
      bounds: {
        ...bounds,
        yMax,
        yMin: yMax - safeW,
        xMax,
        xMin: xMax - safeH,
      },
    });
  };

  return (
    <InspectorSection
      title="Рабочее поле станка"
      icon={<Shield className="w-3.5 h-3.5" />}
      summary={`${bedWidthY}×${bedHeightX} мм`}
      collapsible
      defaultOpen={false}
      storageKey="eznc_sec_machine_bounds"
    >
      <div className="space-y-3">
        {/* Быстрые типоразмеры стола */}
        <div className="flex items-center gap-1 flex-wrap">
          {BED_SIZE_PRESETS.map((preset) => {
            const isActive = bedWidthY === preset.widthY && bedHeightX === preset.heightX;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setBedSize(preset.widthY, preset.heightX)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono tabular-nums font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-fg border-primary'
                    : 'bg-surface-subtle text-fg-secondary border-line hover:text-fg hover:bg-surface-hover'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Два понятных положительных размера стола */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL_CLS}>Ширина стола, мм</label>
            <NumericInput
              value={bedWidthY}
              fallbackValue={2000}
              min={100}
              className={NUM_INPUT_CLS}
              onCommitValue={(val) => setBedSize(val, bedHeightX)}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Глубина стола, мм</label>
            <NumericInput
              value={bedHeightX}
              fallbackValue={1600}
              min={100}
              className={NUM_INPUT_CLS}
              onCommitValue={(val) => setBedSize(bedWidthY, val)}
            />
          </div>
        </div>

        {/* Точные координаты осей для нестандартных станков */}
        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-fg transition-colors cursor-pointer"
          >
            {advancedOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span>Точные координаты осей X / Y / Z</span>
          </button>

          {advancedOpen && (
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-line">
              <div>
                <label className={LABEL_CLS}>Ось X (мин · макс)</label>
                <div className="flex items-center gap-1">
                  <NumericInput
                    value={bounds.xMin}
                    fallbackValue={-1600}
                    className={NUM_INPUT_SM_CLS}
                    onCommitValue={(xMin) => onUpdateMachine({ bounds: { ...bounds, xMin } })}
                  />
                  <span className="text-muted font-mono">..</span>
                  <NumericInput
                    value={bounds.xMax}
                    fallbackValue={0}
                    className={NUM_INPUT_SM_CLS}
                    onCommitValue={(xMax) => onUpdateMachine({ bounds: { ...bounds, xMax } })}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Ось Y (мин · макс)</label>
                <div className="flex items-center gap-1">
                  <NumericInput
                    value={bounds.yMin}
                    fallbackValue={-2000}
                    className={NUM_INPUT_SM_CLS}
                    onCommitValue={(yMin) => onUpdateMachine({ bounds: { ...bounds, yMin } })}
                  />
                  <span className="text-muted font-mono">..</span>
                  <NumericInput
                    value={bounds.yMax}
                    fallbackValue={0}
                    className={NUM_INPUT_SM_CLS}
                    onCommitValue={(yMax) => onUpdateMachine({ bounds: { ...bounds, yMax } })}
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className={LABEL_CLS}>Ось Z (мин · макс)</label>
                <div className="flex items-center gap-1">
                  <NumericInput
                    value={bounds.zMin ?? -50}
                    fallbackValue={-50}
                    className={NUM_INPUT_SM_CLS}
                    onCommitValue={(zMin) => onUpdateMachine({ bounds: { ...bounds, zMin } })}
                  />
                  <span className="text-muted font-mono">..</span>
                  <NumericInput
                    value={bounds.zMax ?? 100}
                    fallbackValue={100}
                    className={NUM_INPUT_SM_CLS}
                    onCommitValue={(zMax) => onUpdateMachine({ bounds: { ...bounds, zMax } })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </InspectorSection>
  );
};

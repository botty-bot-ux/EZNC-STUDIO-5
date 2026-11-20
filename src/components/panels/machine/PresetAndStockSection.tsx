import React from 'react';
import { Square } from 'lucide-react';
import { MachineSettings } from '../../../types';
import { isRailMachine } from '../../../store/initialState';
import { InspectorSection } from '../../ui/InspectorSection';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import {
  STOCK_HEIGHT_LABELS,
  STOCK_HEIGHT_OPTIONS,
  STOCK_WIDTH_OPTIONS,
  withCurrentOption,
} from './stockSheetPresets';

const LABEL_CLS = 'text-[11px] text-muted block mb-1 font-medium';
const SELECT_CLS =
  'w-full bg-surface-subtle border border-line rounded-lg px-2 py-1.5 text-xs text-fg font-semibold focus:border-accent focus:bg-surface focus:outline-none cursor-pointer transition-colors';

interface PresetAndStockSectionProps {
  machine: MachineSettings;
  onApplyPreset: (preset: 'head' | 'rail') => void;
  onUpdateMachine: (partial: Partial<MachineSettings>) => void;
}

export const PresetAndStockSection: React.FC<PresetAndStockSectionProps> = ({
  machine,
  onApplyPreset,
  onUpdateMachine,
}) => {
  const isRail = isRailMachine(machine);
  const stockSheet = machine.stockSheet || {
    enabled: true,
    preset: 'custom',
    widthX: 1081,
    widthY: 1681,
    color: '#22c55e',
  };

  const widthVal = stockSheet.widthY;
  const heightVal = stockSheet.widthX;

  const widthOptions = withCurrentOption(widthVal, STOCK_WIDTH_OPTIONS);
  const heightOptions = withCurrentOption(heightVal, STOCK_HEIGHT_OPTIONS);

  return (
    <>
      <section className="px-3.5 py-3 border-b border-line space-y-2">
        <span className="text-[11px] font-semibold text-muted block">Пресет обработки</span>
        <div className="grid grid-cols-2 gap-1 bg-surface-subtle p-0.5 rounded-lg border border-line">
          <button
            type="button"
            onClick={() => onApplyPreset('head')}
            className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              !isRail
                ? 'bg-primary text-primary-fg font-semibold shadow-2xs'
                : 'text-fg-secondary hover:text-fg'
            }`}
          >
            Изголовье · Ø3
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset('rail')}
            className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isRail
                ? 'bg-primary text-primary-fg font-semibold shadow-2xs'
                : 'text-fg-secondary hover:text-fg'
            }`}
          >
            Царга · Ø8
          </button>
        </div>
      </section>

      <InspectorSection
        title="Заготовка листа"
        icon={<Square className="w-3.5 h-3.5" />}
        summary={stockSheet.enabled ? `${widthVal}×${heightVal}` : 'выкл'}
        headerRight={
          <ToggleSwitch
            checked={stockSheet.enabled}
            ariaLabel="Отображать заготовку листа"
            onChange={(enabled) =>
              onUpdateMachine({
                stockSheet: {
                  ...stockSheet,
                  enabled,
                  preset: enabled ? 'custom' : 'none',
                  color: '#22c55e',
                },
              })
            }
          />
        }
      >
        {stockSheet.enabled ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLS}>Ширина, мм</label>
              <select
                value={widthVal}
                onChange={(e) => {
                  const nextVal = parseFloat(e.target.value) || 1284;
                  onUpdateMachine({
                    stockSheet: {
                      ...stockSheet,
                      enabled: true,
                      preset: 'custom',
                      widthY: nextVal,
                      color: '#22c55e',
                    },
                  });
                }}
                className={`${SELECT_CLS} font-mono tabular-nums`}
              >
                {widthOptions.map((w) => (
                  <option key={w} value={w}>
                    {w} мм
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLS}>Высота, мм</label>
              <select
                value={heightVal}
                onChange={(e) => {
                  const nextVal = parseFloat(e.target.value) || 1084;
                  onUpdateMachine({
                    stockSheet: {
                      ...stockSheet,
                      enabled: true,
                      preset: 'custom',
                      widthX: nextVal,
                      color: '#22c55e',
                    },
                  });
                }}
                className={`${SELECT_CLS} font-mono tabular-nums`}
              >
                {heightOptions.map((h) => (
                  <option key={h} value={h}>
                    {h} мм{STOCK_HEIGHT_LABELS[h] ? ` · ${STOCK_HEIGHT_LABELS[h]}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted leading-snug">
            Включите лист ДСП для визуального контроля раскроя и выравнивания деталей.
          </p>
        )}
      </InspectorSection>
    </>
  );
};

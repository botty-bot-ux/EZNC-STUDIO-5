import React from 'react';
import { Wrench } from 'lucide-react';
import { MachineSettings } from '../../../types';
import { InspectorSection } from '../../ui/InspectorSection';
import { NumericInput } from '../../ui/NumericInput';

const LABEL_CLS = 'text-[11px] text-muted block mb-1 font-medium';
const NUM_INPUT_CLS =
  'w-full bg-surface-subtle border border-line rounded-lg px-2.5 py-1.5 font-mono tabular-nums font-semibold text-fg text-xs focus:bg-surface focus:border-accent focus:outline-none transition-colors';

interface ToolAndFeedsSectionProps {
  machine: MachineSettings;
  onUpdateMachine: (partial: Partial<MachineSettings>) => void;
}

export const ToolAndFeedsSection: React.FC<ToolAndFeedsSectionProps> = ({
  machine,
  onUpdateMachine,
}) => {
  const toolDiameter = machine.toolDiameter ?? 8;
  const cutDepth = machine.cutDepth ?? 5;

  return (
    <InspectorSection
      title="Фреза и режимы"
      icon={<Wrench className="w-3.5 h-3.5" />}
      summary={`Ø${toolDiameter} · ${machine.feedCut} мм/м · Z${cutDepth}`}
      collapsible
      defaultOpen={false}
      storageKey="eznc_sec_tool_feeds_v2"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLS}>Диаметр фрезы, мм</label>
          <NumericInput
            value={toolDiameter}
            fallbackValue={1}
            min={0.1}
            max={50}
            className={NUM_INPUT_CLS}
            onCommitValue={(val) => onUpdateMachine({ toolDiameter: val })}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Глубина реза, мм</label>
          <NumericInput
            value={cutDepth}
            fallbackValue={5}
            min={0}
            className={NUM_INPUT_CLS}
            onCommitValue={(val) => onUpdateMachine({ cutDepth: val })}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Скорость реза</label>
          <NumericInput
            value={machine.feedCut}
            fallbackValue={1000}
            min={0}
            className={NUM_INPUT_CLS}
            onCommitValue={(val) => onUpdateMachine({ feedCut: val })}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Скорость врезания</label>
          <NumericInput
            value={machine.feedPlunge}
            fallbackValue={700}
            min={0}
            className={NUM_INPUT_CLS}
            onCommitValue={(val) => onUpdateMachine({ feedPlunge: val, feedDrill: val })}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Обороты шпинделя</label>
          <NumericInput
            value={machine.spindleSpeed}
            fallbackValue={15000}
            min={0}
            integer
            className={NUM_INPUT_CLS}
            onCommitValue={(val) => onUpdateMachine({ spindleSpeed: val })}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Подъём фрезы Z, мм</label>
          <NumericInput
            value={machine.safeZ}
            fallbackValue={20}
            className={NUM_INPUT_CLS}
            onCommitValue={(val) => onUpdateMachine({ safeZ: val })}
          />
        </div>
      </div>
    </InspectorSection>
  );
};

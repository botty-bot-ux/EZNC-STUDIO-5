import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScrubHandlers } from './useScrub';

interface ScrubChevronsProps {
  up: ScrubHandlers;
  down: ScrubHandlers;
  variant: 'field' | 'dialog';
  titles: { up: string; down: string };
}

export const ScrubChevrons: React.FC<ScrubChevronsProps> = ({ up, down, variant, titles }) => {
  const wrap =
    variant === 'field' ? 'flex flex-col shrink-0 self-stretch' : 'flex flex-col shrink-0';

  const hover =
    'text-muted hover:text-fg hover:bg-surface-hover active:bg-surface-hover transition-colors cursor-ns-resize flex items-center justify-center';

  const btn =
    variant === 'field'
      ? {
          up: `flex-1 px-1 rounded-tr-lg bg-surface-subtle border border-line ${hover}`,
          down: `flex-1 px-1 rounded-br-lg bg-surface-subtle border border-t-0 border-line ${hover}`,
        }
      : {
          up: `flex-1 px-1.5 rounded-t-lg bg-surface-subtle border border-line ${hover}`,
          down: `flex-1 px-1.5 rounded-b-lg bg-surface-subtle border border-t-0 border-line ${hover}`,
        };

  return (
    <div className={wrap}>
      <button type="button" tabIndex={-1} {...up} title={titles.up} className={btn.up}>
        <ChevronUp className="w-3 h-3" />
      </button>
      <button type="button" tabIndex={-1} {...down} title={titles.down} className={btn.down}>
        <ChevronDown className="w-3 h-3" />
      </button>
    </div>
  );
};

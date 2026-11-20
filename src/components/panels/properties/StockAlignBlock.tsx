import React from 'react';
import { parseDecimal } from '../../../lib/utils/num';
import { StockAlignMode, StockSheetSettings } from '../../../types';

const STOCK_CELLS: Array<{ mode: StockAlignMode; title: string; glyph: string }> = [
  { mode: 'topLeft', title: 'К верхнему левому углу листа', glyph: '↖' },
  { mode: 'topCenter', title: 'По центру у верхнего края', glyph: '↑' },
  { mode: 'topRight', title: 'К верхнему правому углу листа', glyph: '↗' },
  { mode: 'centerLeft', title: 'По левому краю (по центру высоты)', glyph: '←' },
  { mode: 'center', title: 'Центрировать на листе ДСП', glyph: '•' },
  { mode: 'centerRight', title: 'По правому краю (по центру высоты)', glyph: '→' },
  { mode: 'bottomLeft', title: 'К нижнему левому углу листа', glyph: '↙' },
  { mode: 'bottomCenter', title: 'По центру у нижнего края', glyph: '↓' },
  { mode: 'bottomRight', title: 'К нижнему правому углу листа', glyph: '↘' },
];

interface StockAlignBlockProps {
  stockSheet?: StockSheetSettings;
  disabled: boolean;
  marginStr: string;
  onMarginChange: (val: string) => void;
  onEnableStockSheet: () => void;
  onAlign: (mode: StockAlignMode, marginMm: number) => void;
}

export const StockAlignBlock: React.FC<StockAlignBlockProps> = ({
  stockSheet,
  disabled,
  marginStr,
  onMarginChange,
  onEnableStockSheet,
  onAlign,
}) => {
  const stockSheetEnabled = Boolean(stockSheet?.enabled && stockSheet.preset !== 'none');
  const stockMarginMm = parseDecimal(marginStr, 0);

  return (
    <div className="space-y-2">
      {!stockSheetEnabled ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-subtle border border-line px-2.5 py-2">
          <span className="text-[11px] text-muted leading-snug">Лист ДСП скрыт</span>
          <button
            type="button"
            onClick={onEnableStockSheet}
            className="px-2 py-1 rounded-md bg-surface hover:bg-surface-hover border border-line text-[11px] font-medium text-fg cursor-pointer shrink-0 transition-colors"
          >
            Включить лист
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">Отступ от края</span>
            <label className="flex items-center gap-1 text-[11px] text-muted">
              <input
                type="text"
                inputMode="decimal"
                value={marginStr}
                onChange={(e) => onMarginChange(e.target.value)}
                className="w-14 bg-surface-subtle border border-line rounded px-1.5 py-0.5 font-mono text-[11px] text-fg text-right tabular-nums focus:border-accent focus:outline-none"
              />
              <span className="font-mono">мм</span>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {STOCK_CELLS.map((cell) => (
              <button
                key={cell.mode}
                type="button"
                disabled={disabled}
                title={cell.title}
                onClick={() => onAlign(cell.mode, stockMarginMm)}
                className="h-7 rounded-md bg-surface-subtle hover:bg-surface-hover border border-line text-xs font-mono text-fg-secondary hover:text-fg disabled:opacity-35 flex items-center justify-center transition-colors cursor-pointer"
              >
                {cell.glyph}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

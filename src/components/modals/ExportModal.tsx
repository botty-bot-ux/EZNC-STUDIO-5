import React from 'react';
import { Cpu, Download, Undo2, X, Zap } from 'lucide-react';
import { OptimizationResult } from '../../lib/geometry/optimizer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
  hasObjects: boolean;
  onOptimize: () => void;
  onExport: () => void;
  onUndoOptimize: () => void;
}

const toLen = (mm: number) => (mm >= 10000 ? `${(mm / 1000).toFixed(2)} м` : `${mm.toFixed(1)} мм`);

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  result,
  hasObjects,
  onOptimize,
  onExport,
  onUndoOptimize,
}) => {
  if (!isOpen) return null;

  const timeSavedStr = result
    ? result.estimatedTimeSavedSec >= 60
      ? `${(result.estimatedTimeSavedSec / 60).toFixed(1)} мин`
      : `${result.estimatedTimeSavedSec.toFixed(1)} сек`
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-100/40 flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full p-5 shadow-lg space-y-4 text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Экспорт на ЧПУ</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:dark:text-slate-200 hover:bg-slate-100 hover:dark:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optimization result or a hint to optimize */}
        {result ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Было</span>
              <span className="text-right font-mono text-slate-500 dark:text-slate-400 line-through">
                {toLen(result.initialDistance)}
              </span>

              <span className="text-slate-500 dark:text-slate-400">Стало</span>
              <span className="text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                {toLen(result.optimizedDistance)}
              </span>

              <span className="text-slate-500 dark:text-slate-400">Экономия</span>
              <span className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {toLen(result.savedDistance)} · −{result.savedPercentage.toFixed(0)}%
              </span>

              <span className="text-slate-500 dark:text-slate-400">Время</span>
              <span className="text-right font-mono font-semibold text-slate-800 dark:text-slate-100">
                ~{timeSavedStr}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-[13px] text-slate-400 dark:text-slate-500">
                {result.reorderedCount}/{result.optimizedObjects.length} переставлено · {result.flippedCount} развёрнуто
              </span>
              <button
                onClick={onUndoOptimize}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:dark:text-rose-400 transition-colors shrink-0"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Отменить
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Маршрут не оптимизирован — выгрузка как есть.</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-700/80 gap-3">
          <button
            onClick={onOptimize}
            disabled={!hasObjects}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 hover:bg-amber-100 hover:dark:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4 fill-amber-500 text-amber-500 dark:text-amber-400" />
            Оптимизировать
          </button>

          <button
            onClick={onExport}
            disabled={!hasObjects}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Экспорт .nc на станок
          </button>
        </div>
      </div>
    </div>
  );
};

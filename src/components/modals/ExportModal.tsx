import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Navigation,
  Sparkles,
  TrendingDown,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white/90 backdrop-blur-2xl border border-white/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-slate-500/20 space-y-5 text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Экспорт на ЧПУ</h3>
              <p className="text-xs text-slate-500">Оптимизируй маршрут и выгрузи чистый G-код на станок</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optimization result or a hint to optimize */}
        {result ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" />
                  <span className="flex items-center gap-1">
                    Маршрут оптимизирован <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </span>
                </span>
                <span className="text-2xl font-black text-emerald-700 bg-emerald-100/80 px-3 py-0.5 rounded-lg border border-emerald-200">
                  -{result.savedPercentage.toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Было:</span>
                  <span className="font-mono text-slate-500 line-through">{toLen(result.initialDistance)}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Стало:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{toLen(result.optimizedDistance)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-sm">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Экономия времени</span>
                </div>
                <div className="font-mono font-bold text-slate-900 text-base">~{timeSavedStr}</div>
                <span className="text-[10px] text-slate-400 block">Меньше времени на переходы</span>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-sm">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Navigation className="w-3.5 h-3.5 text-amber-600" />
                  <span>Сэкономлено пути</span>
                </div>
                <div className="font-mono font-bold text-slate-900 text-base">{toLen(result.savedDistance)}</div>
                <span className="text-[10px] text-slate-400 block">Уменьшен износ механики</span>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-2.5 shadow-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-slate-500 text-[11px]">
                  Переупорядочено объектов: <strong className="text-slate-700">{result.reorderedCount}</strong> из{' '}
                  {result.optimizedObjects.length}. Развернуто векторов:{' '}
                  <strong className="text-slate-700">{result.flippedCount}</strong>.
                </p>
              </div>
              <button
                onClick={onUndoOptimize}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Отменить оптимизацию
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-xs text-slate-500 flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Маршрут не оптимизирован. Можно сразу выгрузить G-код как есть, либо сначала сократить холостой ход
              кнопкой «Оптимизировать».
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 gap-3">
          <button
            onClick={onOptimize}
            disabled={!hasObjects}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
            Оптимизировать
          </button>

          <button
            onClick={onExport}
            disabled={!hasObjects}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/25 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Экспорт .nc на станок
          </button>
        </div>
      </div>
    </div>
  );
};

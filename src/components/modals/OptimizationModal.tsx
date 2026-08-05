import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Navigation,
  Sparkles,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react';
import { OptimizationResult } from '../../lib/geometry/optimizer';
import { useProjectStore } from '../../store/useProjectStore';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
}

export const OptimizationModal: React.FC<OptimizationModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  const { undo } = useProjectStore();

  if (!isOpen || !result) return null;

  const handleUndo = () => {
    undo();
    onClose();
  };

  const initialKmOrMm =
    result.initialDistance >= 10000
      ? `${(result.initialDistance / 1000).toFixed(2)} м`
      : `${result.initialDistance.toFixed(1)} мм`;

  const optimizedKmOrMm =
    result.optimizedDistance >= 10000
      ? `${(result.optimizedDistance / 1000).toFixed(2)} м`
      : `${result.optimizedDistance.toFixed(1)} мм`;

  const savedKmOrMm =
    result.savedDistance >= 1000
      ? `${(result.savedDistance / 1000).toFixed(2)} м`
      : `${result.savedDistance.toFixed(1)} мм`;

  const timeSavedStr =
    result.estimatedTimeSavedSec >= 60
      ? `${(result.estimatedTimeSavedSec / 60).toFixed(1)} мин`
      : `${result.estimatedTimeSavedSec.toFixed(1)} сек`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white/90 backdrop-blur-2xl border border-white/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-slate-500/20 space-y-5 text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                Маршрут ЧПУ Оптимизирован!
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-xs text-slate-500">
                Сокращен холостой ход станка и переупорядочены векторы
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero savings banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" />
              Сокращение холостого хода
            </span>
            <span className="text-2xl font-black text-emerald-700 bg-emerald-100/80 px-3 py-0.5 rounded-lg border border-emerald-200">
              -{result.savedPercentage.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Было:</span>
              <span className="font-mono text-slate-500 line-through">{initialKmOrMm}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Стало:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">{optimizedKmOrMm}</span>
            </div>
          </div>
        </div>

        {/* Detail statistics cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Экономия времени</span>
            </div>
            <div className="font-mono font-bold text-slate-900 text-base">
              ~{timeSavedStr}
            </div>
            <span className="text-[10px] text-slate-400 block">Меньше времени на переходы</span>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Navigation className="w-3.5 h-3.5 text-amber-600" />
              <span>Сэкономлено пути</span>
            </div>
            <div className="font-mono font-bold text-slate-900 text-base">
              {savedKmOrMm}
            </div>
            <span className="text-[10px] text-slate-400 block">Уменьшен износ механики</span>
          </div>
        </div>

        {/* Feature summary details */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-2.5 shadow-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Группировка ближних объектов:</span>
              <p className="text-slate-500 text-[11px]">
                Переупорядочено объектов: <strong className="text-slate-700">{result.reorderedCount}</strong> из {result.optimizedObjects.length}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Реверс направления отрезков:</span>
              <p className="text-slate-500 text-[11px]">
                Развернуто начал/концов: <strong className="text-slate-700">{result.flippedCount}</strong> векторов для выстраивания непрерывного кратчайшего пути.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 gap-3">
          <button
            onClick={handleUndo}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all shadow-sm"
          >
            Отменить оптимизацию
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
          >
            Принять и продолжить
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { OptimizationResult } from '../../lib/geometry/optimizer';
import { computeToolpathStats, formatDistanceRu, formatDurationRu } from '../../lib/gcode/stats';
import { useProjectStore } from '../../store/useProjectStore';
import { ToggleSwitch } from '../ui/ToggleSwitch';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
  hasObjects: boolean;
  onOptimize: () => void;
  onExport: () => Promise<boolean>;
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
  const { toolpathSegments, machine, warnings, openSafetyDrawer } = useProjectStore(
    useShallow((s) => ({
      toolpathSegments: s.toolpathSegments,
      machine: s.machine,
      warnings: s.warnings,
      openSafetyDrawer: s.openSafetyDrawer,
    }))
  );

  const [autoOptimize, setAutoOptimize] = useState(true);

  const stats = useMemo(
    () => computeToolpathStats(toolpathSegments, machine),
    [toolpathSegments, machine]
  );

  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const timeSavedStr = result
    ? result.estimatedTimeSavedSec >= 60
      ? `${(result.estimatedTimeSavedSec / 60).toFixed(1)} мин`
      : `${result.estimatedTimeSavedSec.toFixed(1)} сек`
    : '';

  const handlePrimaryExport = async () => {
    if (!hasObjects) return;
    if (autoOptimize && !result) {
      onOptimize();
    }
    if (await onExport()) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Выгрузка программы на станок"
        className="bg-surface border border-line rounded-xl max-w-md w-full p-5 shadow-xl space-y-4 text-fg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-fg">Выгрузить на станок (.nc)</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Закрыть"
            aria-label="Закрыть окно"
            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Статус проверки безопасности */}
        {hasObjects && (
          errorCount > 0 ? (
            <div className="flex items-center justify-between gap-2.5 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-danger min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium leading-snug">
                  Найдено ошибок: {errorCount} — проверьте выход за пределы стола
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openSafetyDrawer();
                }}
                className="px-2.5 py-1 rounded-md bg-surface border border-line text-fg text-[11px] font-semibold hover:bg-surface-hover whitespace-nowrap shrink-0 cursor-pointer"
              >
                Показать
              </button>
            </div>
          ) : warningCount > 0 ? (
            <div className="flex items-center justify-between gap-2.5 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-fg min-w-0">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <span className="leading-snug">
                  Есть предупреждений: <strong className="font-mono tabular-nums">{warningCount}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openSafetyDrawer();
                }}
                className="px-2.5 py-1 rounded-md bg-surface border border-line text-fg text-[11px] font-semibold hover:bg-surface-hover whitespace-nowrap shrink-0 cursor-pointer"
              >
                Показать
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-surface-subtle border border-line px-3 py-2 text-xs text-fg-secondary">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>Проверка пройдена · программа готова для станка</span>
            </div>
          )
        )}

        {/* Компактная сводка времени и пробега */}
        {hasObjects && stats.estimatedSeconds > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-subtle border border-line px-3 py-2.5 text-xs">
            <div>
              <span className="text-[11px] text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" /> Время
              </span>
              <span className="font-mono tabular-nums font-semibold text-fg">
                ~{formatDurationRu(stats.estimatedSeconds)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted block">Рабочий рез</span>
              <span className="font-mono tabular-nums font-semibold text-fg">
                {formatDistanceRu(stats.cutLengthMm)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted block">Перелёты</span>
              <span className="font-mono tabular-nums font-semibold text-fg-secondary">
                {formatDistanceRu(stats.rapidLengthMm)}
              </span>
            </div>
          </div>
        )}

        {/* Автооптимизация в 1 клик + детали экономии при желании */}
        {result ? (
          <div className="space-y-2.5 rounded-lg border border-line px-3 py-2.5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-muted">Холостые перелёты</span>
              <span className="text-right font-mono tabular-nums">
                <span className="text-muted line-through mr-1.5">{toLen(result.initialDistance)}</span>
                <strong className="text-fg">{toLen(result.optimizedDistance)}</strong>
              </span>

              <span className="text-muted">Сокращение пробега</span>
              <span className="text-right font-mono tabular-nums font-semibold text-success">
                −{result.savedPercentage.toFixed(0)}% ({toLen(result.savedDistance)})
              </span>

              <span className="text-muted">Экономия времени</span>
              <span className="text-right font-mono tabular-nums font-semibold text-fg">~{timeSavedStr}</span>
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono tabular-nums text-muted">
                {result.reorderedCount}/{result.optimizedObjects.length} переставлено ·{' '}
                {result.flippedCount} развёрнуто
              </span>
              <button
                type="button"
                onClick={onUndoOptimize}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-danger transition-colors shrink-0 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Откатить
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="min-w-0">
              <div className="text-xs font-medium text-fg">Оптимизировать порядок резки</div>
              <div className="text-[11px] text-muted mt-0.5 leading-snug">
                Автоматически сократит лишние холостые перелёты при скачивании
              </div>
            </div>
            <ToggleSwitch
              checked={autoOptimize}
              ariaLabel="Оптимизировать порядок резки перед сохранением"
              onChange={setAutoOptimize}
            />
          </div>
        )}

        {/* Кнопки */}
        <div className="flex items-center justify-between pt-3 border-t border-line gap-2.5">
          {!result ? (
            <button
              type="button"
              onClick={onOptimize}
              disabled={!hasObjects}
              title="Посмотреть экономию маршрута до скачивания файла"
              className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:text-fg bg-surface-subtle border border-line hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>Проверить экономию</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover border border-line transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Закрыть
            </button>
          )}

          <button
            type="button"
            onClick={handlePrimaryExport}
            disabled={!hasObjects}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Скачать .nc</span>
          </button>
        </div>
      </div>
    </div>
  );
};

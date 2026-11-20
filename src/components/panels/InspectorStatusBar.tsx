import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { computeToolpathStats, formatDistanceRu, formatDurationRu } from '../../lib/gcode/stats';
import { useProjectStore } from '../../store/useProjectStore';

/**
 * Постоянная нижняя строка состояния правой панели (и мобильной шторки):
 * всегда показывает результат проверки безопасности и сводку времени/длины УП.
 * По клику раскрывает компактный список предупреждений с быстрым переходом «Найти».
 */
export const InspectorStatusBar: React.FC = () => {
  const {
    warnings,
    toolpathSegments,
    machine,
    safetyDrawerOpen,
    setSafetyDrawerOpen,
    setSelectedObjectId,
    focusCanvasOnObject,
  } = useProjectStore(
    useShallow((s) => ({
      warnings: s.warnings,
      toolpathSegments: s.toolpathSegments,
      machine: s.machine,
      safetyDrawerOpen: s.safetyDrawerOpen,
      setSafetyDrawerOpen: s.setSafetyDrawerOpen,
      setSelectedObjectId: s.setSelectedObjectId,
      focusCanvasOnObject: s.focusCanvasOnObject,
    }))
  );

  const stats = useMemo(
    () => computeToolpathStats(toolpathSegments, machine),
    [toolpathSegments, machine]
  );

  const errors = useMemo(() => warnings.filter((w) => w.level === 'error'), [warnings]);
  const warnList = useMemo(() => warnings.filter((w) => w.level === 'warning'), [warnings]);
  const infos = useMemo(() => warnings.filter((w) => w.level === 'info'), [warnings]);

  const hasIssues = errors.length > 0 || warnList.length > 0;
  const hasToolpath = stats.cutLengthMm + stats.rapidLengthMm > 0 || stats.drillCount > 0;

  const statusText =
    errors.length > 0
      ? warnList.length > 0
        ? `${errors.length} ош. · ${warnList.length} пред.`
        : `${errors.length} ош.`
      : warnList.length > 0
      ? `${warnList.length} пред.`
      : 'Готово';

  const handleLocate = (objectId: string) => {
    setSelectedObjectId(objectId);
    focusCanvasOnObject(objectId);
    setSafetyDrawerOpen(false);
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface-subtle select-none">
      {/* Выдвижная шторка проверки безопасности */}
      {safetyDrawerOpen && (
        <div className="border-b border-line bg-surface max-h-60 flex flex-col">
          <div className="px-3 py-1.5 bg-surface-subtle border-b border-line flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-fg">
              Проверка безопасности · {warnings.length}
            </span>
            <button
              type="button"
              onClick={() => setSafetyDrawerOpen(false)}
              title="Скрыть список проверок"
              className="p-0.5 rounded text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto p-2.5 space-y-2">
            {warnings.length === 0 ? (
              <div className="py-2 px-2.5 bg-surface-subtle border border-line rounded-lg flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs text-fg">Все проверки пройдены</div>
                  <p className="text-[11px] text-muted mt-0.5 leading-snug">
                    Выходов за границы рабочей зоны станка не обнаружено.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {errors.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-danger/10 border border-danger/30 rounded-lg text-danger space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-xs min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      {item.objectId && (
                        <button
                          type="button"
                          onClick={() => handleLocate(item.objectId!)}
                          className="text-[11px] bg-danger/15 hover:bg-danger/25 px-2 py-0.5 rounded font-medium transition-colors shrink-0 cursor-pointer"
                        >
                          Найти
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">{item.message}</p>
                  </div>
                ))}

                {warnList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-warning/10 border border-warning/30 rounded-lg text-fg space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-warning min-w-0">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      {item.objectId && (
                        <button
                          type="button"
                          onClick={() => handleLocate(item.objectId!)}
                          className="text-[11px] bg-surface hover:bg-surface-hover border border-line text-fg px-2 py-0.5 rounded font-medium transition-colors shrink-0 cursor-pointer"
                        >
                          Найти
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-fg-secondary leading-relaxed">{item.message}</p>
                  </div>
                ))}

                {infos.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-surface-subtle border border-line rounded-lg text-fg space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-fg">
                      <Info className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">{item.message}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Компактная полоса статуса и живой сводки УП */}
      <div className="px-3 h-9 flex items-center justify-between gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setSafetyDrawerOpen(!safetyDrawerOpen)}
          title="Открыть или скрыть результаты проверки безопасности"
          aria-expanded={safetyDrawerOpen}
          className={`flex items-center gap-1.5 py-1 px-1.5 -ml-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap min-w-0 ${
            errors.length > 0
              ? 'text-danger hover:bg-danger/10 font-semibold'
              : warnList.length > 0
              ? 'text-warning hover:bg-warning/10 font-semibold'
              : 'text-fg-secondary hover:bg-surface-hover font-medium'
          }`}
        >
          {errors.length > 0 ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          ) : warnList.length > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
          )}
          <span className={hasIssues ? 'font-mono' : ''}>{statusText}</span>
          {safetyDrawerOpen ? (
            <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
          ) : (
            <ChevronUp className="w-3 h-3 opacity-70 shrink-0" />
          )}
        </button>

        <div
          className="font-mono text-[11px] text-muted flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title={
            hasToolpath
              ? `Расчётное время обработки и путь реза (${formatDistanceRu(stats.cutLengthMm)})`
              : 'Нет активной траектории'
          }
        >
          {hasToolpath ? (
            <>
              <span className="text-fg-secondary font-medium">
                {formatDurationRu(stats.estimatedSeconds)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {stats.cutLengthMm > 0
                  ? formatDistanceRu(stats.cutLengthMm)
                  : `${stats.drillCount} отв.`}
              </span>
            </>
          ) : (
            <span>Нет траектории</span>
          )}
        </div>
      </div>
    </div>
  );
};

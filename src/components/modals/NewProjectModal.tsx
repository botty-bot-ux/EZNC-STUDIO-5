import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CircleDot,
  SlidersHorizontal,
  Spline,
  X,
} from 'lucide-react';
import { isRailMachine, PROJECT_MODE_PRESETS, ProjectMode } from '../../store/initialState';
import { NewProjectOptions } from '../../store/projectStore.types';
import { MachineSettings, StockSheetSettings } from '../../types';
import {
  BED_SIZE_PRESETS,
  STOCK_HEIGHT_LABELS,
  STOCK_HEIGHT_OPTIONS,
  STOCK_WIDTH_OPTIONS,
  withCurrentOption,
} from '../panels/machine/stockSheetPresets';
import { NumericInput } from '../ui/NumericInput';
import { ToggleSwitch } from '../ui/ToggleSwitch';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasObjects: boolean;
  currentMachine: MachineSettings;
  onCreate: (mode: ProjectMode, options: NewProjectOptions) => void;
}

const LABEL_CLS = 'text-xs text-muted block mb-1.5 font-medium';
const SELECT_CLS =
  'w-full bg-surface-subtle border border-line rounded-lg px-3 py-2 text-xs text-fg font-semibold font-mono tabular-nums focus:border-accent focus:bg-surface focus:outline-none cursor-pointer transition-colors';
const NUM_INPUT_CLS =
  'w-full bg-surface-subtle border border-line rounded-lg px-2.5 py-2 font-mono tabular-nums text-xs text-fg font-semibold focus:bg-surface focus:border-accent focus:outline-none transition-colors';
const NUM_INPUT_SM_CLS =
  'w-full bg-surface-subtle border border-line rounded-lg px-1.5 py-1.5 font-mono tabular-nums text-xs text-fg font-semibold focus:bg-surface focus:border-accent focus:outline-none transition-colors text-center';

function buildInitialStock(mode: ProjectMode): StockSheetSettings {
  const preset = PROJECT_MODE_PRESETS[mode].stockSheet;
  return {
    enabled: true,
    preset: 'custom',
    widthX: preset?.widthX ?? 1081,
    widthY: preset?.widthY ?? 1681,
    color: preset?.color ?? '#22c55e',
  };
}

/**
 * Компактная пропорциональная схема: лист ДСП на рабочем столе станка
 * (рабочий ноль 0,0 в правом нижнем углу — точно как на 2D-холсте).
 */
const SheetOnBedPreview: React.FC<{
  bedW: number;
  bedH: number;
  sheetW: number;
  sheetH: number;
  sheetEnabled: boolean;
  overflows: boolean;
}> = ({ bedW, bedH, sheetW, sheetH, sheetEnabled, overflows }) => {
  const safeBedW = Math.max(bedW, 100);
  const safeBedH = Math.max(bedH, 100);
  const maxW = sheetEnabled ? Math.max(safeBedW, sheetW) : safeBedW;
  const maxH = sheetEnabled ? Math.max(safeBedH, sheetH) : safeBedH;

  const boxW = 104;
  const boxH = 62;
  const pad = 7;
  const scale = Math.min((boxW - pad * 2) / maxW, (boxH - pad * 2) / maxH);

  const drawBedW = safeBedW * scale;
  const drawBedH = safeBedH * scale;
  const originX = boxW - pad - (maxW * scale - drawBedW) / 2;
  const originY = boxH - pad - (maxH * scale - drawBedH) / 2;

  const bedX = originX - drawBedW;
  const bedY = originY - drawBedH;

  const drawSheetW = sheetW * scale;
  const drawSheetH = sheetH * scale;
  const sheetX = originX - drawSheetW;
  const sheetY = originY - drawSheetH;

  return (
    <svg
      width={boxW}
      height={boxH}
      viewBox={`0 0 ${boxW} ${boxH}`}
      aria-hidden="true"
      className="shrink-0 rounded-lg bg-surface-subtle border border-line"
    >
      {/* Стол станка */}
      <rect
        x={bedX}
        y={bedY}
        width={drawBedW}
        height={drawBedH}
        rx={1.5}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.32}
        strokeWidth={1}
      />

      {/* Лист ДСП (привязан к рабочему нулю в правом нижнем углу) */}
      {sheetEnabled && (
        <rect
          x={sheetX}
          y={sheetY}
          width={drawSheetW}
          height={drawSheetH}
          rx={1.5}
          fill={overflows ? 'rgba(217, 119, 6, 0.14)' : 'rgba(34, 197, 94, 0.16)'}
          stroke={overflows ? '#d97706' : '#22c55e'}
          strokeWidth={1.3}
          strokeDasharray="3 2"
        />
      )}

      {/* Точка рабочего нуля 0,0 */}
      <circle cx={originX} cy={originY} r={2.2} fill="#2563eb" />
    </svg>
  );
};

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  hasObjects,
  currentMachine,
  onCreate,
}) => {
  const [mode, setMode] = useState<ProjectMode>(() =>
    isRailMachine(currentMachine) ? 'rail' : 'head'
  );
  const [stockSheet, setStockSheet] = useState<StockSheetSettings>(() =>
    buildInitialStock(isRailMachine(currentMachine) ? 'rail' : 'head')
  );
  const [bounds, setBounds] = useState<MachineSettings['bounds']>(() => ({
    ...currentMachine.bounds,
  }));
  const [bedEditorOpen, setBedEditorOpen] = useState(false);
  const [advancedAxesOpen, setAdvancedAxesOpen] = useState(false);

  // При каждом открытии синхронизируем поля с текущим станком и сворачиваем доп. настройки
  useEffect(() => {
    if (!isOpen) return;
    const initialMode: ProjectMode = isRailMachine(currentMachine) ? 'rail' : 'head';
    setMode(initialMode);
    setStockSheet(buildInitialStock(initialMode));
    setBounds({ ...currentMachine.bounds });
    setBedEditorOpen(false);
    setAdvancedAxesOpen(false);
  }, [isOpen, currentMachine]);

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

  const handleModeChange = (nextMode: ProjectMode) => {
    setMode(nextMode);
    const presetStock = buildInitialStock(nextMode);
    setStockSheet((prev) => ({
      ...presetStock,
      enabled: prev.enabled,
      preset: prev.enabled ? 'custom' : 'none',
    }));
  };

  const widthOptions = withCurrentOption(stockSheet.widthY, STOCK_WIDTH_OPTIONS);
  const heightOptions = withCurrentOption(stockSheet.widthX, STOCK_HEIGHT_OPTIONS);

  const bedWidthY = Math.round(Math.abs(bounds.yMax - bounds.yMin));
  const bedHeightX = Math.round(Math.abs(bounds.xMax - bounds.xMin));

  const setBedSize = (nextWidthY: number, nextHeightX: number) => {
    const safeW = Math.max(100, Math.round(nextWidthY));
    const safeH = Math.max(100, Math.round(nextHeightX));
    setBounds((prev) => {
      const yMax = Math.max(prev.yMin, prev.yMax);
      const xMax = Math.max(prev.xMin, prev.xMax);
      return {
        ...prev,
        yMax,
        yMin: yMax - safeW,
        xMax,
        xMin: xMax - safeH,
      };
    });
  };

  const sheetOverflowsBed =
    stockSheet.enabled && (stockSheet.widthY > bedWidthY || stockSheet.widthX > bedHeightX);

  const fitBedToSheet = () => {
    setBedSize(Math.max(bedWidthY, stockSheet.widthY), Math.max(bedHeightX, stockSheet.widthX));
  };

  const modeOptions: Array<{
    id: ProjectMode;
    title: string;
    detail: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'head',
      title: 'Изголовье',
      detail: 'Фреза Ø3 мм · узор и контуры',
      Icon: Spline,
    },
    {
      id: 'rail',
      title: 'Царга',
      detail: 'Фреза Ø8 мм · рез и сверловка',
      Icon: CircleDot,
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(mode, {
      bounds: { ...bounds },
      stockSheet: {
        ...stockSheet,
        preset: stockSheet.enabled ? 'custom' : 'none',
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-label="Новый проект"
        onSubmit={handleSubmit}
        className="bg-surface border border-line rounded-xl max-w-md w-full max-h-[90vh] flex flex-col shadow-xl text-fg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div>
            <h3 className="font-semibold text-sm text-fg">Новый проект</h3>
            {hasObjects && (
              <p className="text-[11px] text-muted mt-0.5">
                Текущий чертёж очистится · можно вернуть через Ctrl+Z
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Закрыть"
            aria-label="Закрыть окно"
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Тело формы: минимум полей на первом экране, тонкие настройки — по клику */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* 1. Что делаем */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-fg block">Что делаем</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {modeOptions.map(({ id, title, detail, Icon }) => {
                const active = mode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleModeChange(id)}
                    aria-pressed={active}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left cursor-pointer ${
                      active
                        ? 'border-accent bg-accent/8 text-fg'
                        : 'border-line bg-surface-subtle hover:bg-surface-hover hover:border-line-strong text-fg'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? 'bg-accent text-accent-fg border-accent'
                          : 'bg-surface border-line text-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-fg">{title}</div>
                      <div className="text-[11px] text-muted mt-0.5 leading-snug">{detail}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Лист ДСП */}
          <div className="pt-4 border-t border-line space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-fg">Лист ДСП</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted">
                  {stockSheet.enabled ? 'Показать на поле' : 'Без листа'}
                </span>
                <ToggleSwitch
                  checked={stockSheet.enabled}
                  ariaLabel="Отображать лист ДСП на холсте"
                  onChange={(enabled) =>
                    setStockSheet((prev) => ({
                      ...prev,
                      enabled,
                      preset: enabled ? 'custom' : 'none',
                    }))
                  }
                />
              </div>
            </div>

            {stockSheet.enabled && (
              <div className="flex items-end gap-3">
                <div className="grid grid-cols-2 gap-2.5 flex-1 min-w-0">
                  <div>
                    <label className={LABEL_CLS}>Ширина, мм</label>
                    <select
                      value={stockSheet.widthY}
                      onChange={(e) => {
                        const nextVal = parseFloat(e.target.value) || 1681;
                        setStockSheet((prev) => ({
                          ...prev,
                          enabled: true,
                          preset: 'custom',
                          widthY: nextVal,
                        }));
                      }}
                      className={SELECT_CLS}
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
                      value={stockSheet.widthX}
                      onChange={(e) => {
                        const nextVal = parseFloat(e.target.value) || 1081;
                        setStockSheet((prev) => ({
                          ...prev,
                          enabled: true,
                          preset: 'custom',
                          widthX: nextVal,
                        }));
                      }}
                      className={SELECT_CLS}
                    >
                      {heightOptions.map((h) => (
                        <option key={h} value={h}>
                          {h} мм{STOCK_HEIGHT_LABELS[h] ? ` · ${STOCK_HEIGHT_LABELS[h]}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="hidden sm:block">
                  <SheetOnBedPreview
                    bedW={bedWidthY}
                    bedH={bedHeightX}
                    sheetW={stockSheet.widthY}
                    sheetH={stockSheet.widthX}
                    sheetEnabled={stockSheet.enabled}
                    overflows={sheetOverflowsBed}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Рабочее поле станка — свёрнуто в одну спокойную строку, открывается по клику */}
          <div className="pt-4 border-t border-line space-y-3">
            <button
              type="button"
              onClick={() => setBedEditorOpen((v) => !v)}
              aria-expanded={bedEditorOpen}
              className="w-full flex items-center justify-between gap-2 text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted shrink-0" />
                <span className="text-xs font-semibold text-fg">Рабочее поле станка</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono tabular-nums text-xs text-fg-secondary">
                  {bedWidthY} × {bedHeightX} мм
                </span>
                <span className="text-[11px] font-medium text-accent group-hover:underline">
                  {bedEditorOpen ? 'Скрыть' : 'Изменить'}
                </span>
                {bedEditorOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted" />
                )}
              </div>
            </button>

            {/* Мягкое предупреждение, если лист не помещается на текущий стол */}
            {sheetOverflowsBed && (
              <div className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-xs">
                <div className="flex items-center gap-2 min-w-0 text-fg">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                  <span className="text-[11px] leading-snug">
                    Лист больше стола (<span className="font-mono tabular-nums">{stockSheet.widthY}×{stockSheet.widthX}</span> против{' '}
                    <span className="font-mono tabular-nums">{bedWidthY}×{bedHeightX}</span> мм)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fitBedToSheet}
                  className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-line text-[11px] font-semibold text-fg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  Расширить стол
                </button>
              </div>
            )}

            {bedEditorOpen && (
              <div className="space-y-3 pt-1">
                {/* Быстрые типоразмеры стола в один клик */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {BED_SIZE_PRESETS.map((preset) => {
                    const isActive = bedWidthY === preset.widthY && bedHeightX === preset.heightX;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setBedSize(preset.widthY, preset.heightX)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono tabular-nums font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

                {/* Только 2 понятных положительных числа вместо 6 отрицательных координат */}
                <div className="grid grid-cols-2 gap-2.5">
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

                {/* Точные координаты X/Y/Z — скрыты вторым уровнем только для опытной настройки */}
                <div>
                  <button
                    type="button"
                    onClick={() => setAdvancedAxesOpen((v) => !v)}
                    aria-expanded={advancedAxesOpen}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-fg transition-colors cursor-pointer"
                  >
                    {advancedAxesOpen ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    <span>Точные координаты осей X / Y / Z</span>
                  </button>

                  {advancedAxesOpen && (
                    <div className="grid grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-line">
                      <div>
                        <label className="text-[11px] text-muted block mb-1 font-medium">
                          Ось X (мин · макс)
                        </label>
                        <div className="flex items-center gap-1">
                          <NumericInput
                            value={bounds.xMin}
                            fallbackValue={-1600}
                            className={NUM_INPUT_SM_CLS}
                            onCommitValue={(xMin) => setBounds((prev) => ({ ...prev, xMin }))}
                          />
                          <span className="text-muted font-mono">..</span>
                          <NumericInput
                            value={bounds.xMax}
                            fallbackValue={0}
                            className={NUM_INPUT_SM_CLS}
                            onCommitValue={(xMax) => setBounds((prev) => ({ ...prev, xMax }))}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-muted block mb-1 font-medium">
                          Ось Y (мин · макс)
                        </label>
                        <div className="flex items-center gap-1">
                          <NumericInput
                            value={bounds.yMin}
                            fallbackValue={-2000}
                            className={NUM_INPUT_SM_CLS}
                            onCommitValue={(yMin) => setBounds((prev) => ({ ...prev, yMin }))}
                          />
                          <span className="text-muted font-mono">..</span>
                          <NumericInput
                            value={bounds.yMax}
                            fallbackValue={0}
                            className={NUM_INPUT_SM_CLS}
                            onCommitValue={(yMax) => setBounds((prev) => ({ ...prev, yMax }))}
                          />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="text-[11px] text-muted block mb-1 font-medium">
                          Ось Z (мин · макс)
                        </label>
                        <div className="flex items-center gap-1">
                          <NumericInput
                            value={bounds.zMin ?? -50}
                            fallbackValue={-50}
                            className={NUM_INPUT_SM_CLS}
                            onCommitValue={(zMin) => setBounds((prev) => ({ ...prev, zMin }))}
                          />
                          <span className="text-muted font-mono">..</span>
                          <NumericInput
                            value={bounds.zMax ?? 100}
                            fallbackValue={100}
                            className={NUM_INPUT_SM_CLS}
                            onCommitValue={(zMax) => setBounds((prev) => ({ ...prev, zMax }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-surface-subtle border-t border-line shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover border border-line transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Создать проект
          </button>
        </div>
      </form>
    </div>
  );
};

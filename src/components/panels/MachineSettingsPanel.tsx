import React from 'react';
import {
  Shield,
  Square,
  Wrench,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ImagePlus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Maximize,
  Trash2,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';

const WIDTH_OPTIONS = [881, 981, 1281, 1481, 1681, 1881, 2081];
const HEIGHT_OPTIONS = [250, 360, 1081, 1121, 1201];
const HEIGHT_LABELS: Record<number, string> = { 250: 'парящая', 360: 'царга' };

export const MachineSettingsPanel: React.FC = () => {
  const {
    machine,
    updateMachine,
    warnings,
    setSelectedObjectId,
    underlay,
    setUnderlayImage,
    updateUnderlay,
    fitUnderlayToSheet,
    clearUnderlay,
  } = useProjectStore(
    useShallow((s) => ({
      machine: s.machine,
      updateMachine: s.updateMachine,
      warnings: s.warnings,
      setSelectedObjectId: s.setSelectedObjectId,
      underlay: s.underlay,
      setUnderlayImage: s.setUnderlayImage,
      updateUnderlay: s.updateUnderlay,
      fitUnderlayToSheet: s.fitUnderlayToSheet,
      clearUnderlay: s.clearUnderlay,
    }))
  );

  const stockSheet = machine.stockSheet || {
    enabled: true,
    preset: 'custom',
    widthX: 1081,
    widthY: 1681,
    color: '#22c55e',
  };

  const widthVal = stockSheet.widthY;
  const heightVal = stockSheet.widthX;

  const widthOptions = WIDTH_OPTIONS.includes(widthVal)
    ? WIDTH_OPTIONS
    : [widthVal, ...WIDTH_OPTIONS].sort((a, b) => a - b);

  const heightOptions = HEIGHT_OPTIONS.includes(heightVal)
    ? HEIGHT_OPTIONS
    : [heightVal, ...HEIGHT_OPTIONS].sort((a, b) => a - b);

  const handleUnderlayFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setUnderlayImage(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // разрешить повторно выбрать тот же файл
  };

  const errors = warnings.filter((w) => w.level === 'error');
  const warnList = warnings.filter((w) => w.level === 'warning');
  const infos = warnings.filter((w) => w.level === 'info');

  return (
    <div className="p-3 space-y-3 text-xs text-slate-800 dark:text-slate-100 overflow-y-auto h-full custom-scrollbar">
      {/* 1. ЗАГОТОВКА ЛИСТА */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5 text-accent" />
            Заготовка листа
          </span>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={stockSheet.enabled}
              onChange={(e) =>
                updateMachine({
                  stockSheet: {
                    ...stockSheet,
                    enabled: e.target.checked,
                    preset: e.target.checked ? 'custom' : 'none',
                    color: '#22c55e',
                  },
                })
              }
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:dark:border-slate-700 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:dark:bg-slate-900 after:border-slate-300 after:dark:border-slate-600 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>

        {stockSheet.enabled && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Ширина (Y, мм)
              </label>
              <select
                value={widthVal}
                onChange={(e) => {
                  const nextVal = parseFloat(e.target.value) || 1284;
                  updateMachine({
                    stockSheet: {
                      ...stockSheet,
                      enabled: true,
                      preset: 'custom',
                      widthY: nextVal,
                      color: '#22c55e',
                    },
                  });
                }}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-bold focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:outline-none cursor-pointer transition-all"
              >
                {widthOptions.map((w) => (
                  <option key={w} value={w}>
                    {w} мм
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Высота (X, мм)
              </label>
              <select
                value={heightVal}
                onChange={(e) => {
                  const nextVal = parseFloat(e.target.value) || 1084;
                  updateMachine({
                    stockSheet: {
                      ...stockSheet,
                      enabled: true,
                      preset: 'custom',
                      widthX: nextVal,
                      color: '#22c55e',
                    },
                  });
                }}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-bold focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:outline-none cursor-pointer transition-all"
              >
                {heightOptions.map((h) => (
                  <option key={h} value={h}>
                    {h} мм{HEIGHT_LABELS[h] ? ` (${HEIGHT_LABELS[h]})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. ИНСТРУМЕНТ И РЕЖИМЫ */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2.5">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-accent" />
          Инструмент и режимы
        </span>

        {/* Диаметр фрезы */}
        <div className="pt-1">
          <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
            Диаметр фрезы (мм)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="50"
              value={machine.toolDiameter ?? 8}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1;
                updateMachine({ toolDiameter: Math.max(0.1, val) });
              }}
              className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all"
            />
            <span className="text-slate-400 dark:text-slate-500 font-bold text-xs shrink-0">мм</span>
          </div>
        </div>

        {/* Spindle & Feeds */}
        <div className="space-y-2 pt-1">
          <div>
            <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
              Обороты (об/мин)
            </label>
            <input
              type="number"
              value={machine.spindleSpeed}
              onChange={(e) => updateMachine({ spindleSpeed: parseInt(e.target.value) || 15000 })}
              className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Подача (F cut)
              </label>
              <input
                type="number"
                value={machine.feedCut}
                onChange={(e) => updateMachine({ feedCut: parseFloat(e.target.value) || 1000 })}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Врезание (F plunge)
              </label>
              <input
                type="number"
                value={machine.feedPlunge}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 700;
                  updateMachine({ feedPlunge: val, feedDrill: val });
                }}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Высоты Z */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Безопасная Z (мм)
              </label>
              <input
                type="number"
                value={machine.safeZ}
                onChange={(e) => updateMachine({ safeZ: parseFloat(e.target.value) || 20 })}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Глубина реза Z (мм)
              </label>
              <input
                type="number"
                step="0.5"
                value={machine.cutDepth ?? 5}
                onChange={(e) => updateMachine({ cutDepth: parseFloat(e.target.value) || 5 })}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-primary focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. РАБОЧАЯ ЗОНА СТАНКА */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-accent" />
          Границы рабочей зоны
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
              Ось X (мин..макс)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={machine.bounds.xMin}
                onChange={(e) =>
                  updateMachine({
                    bounds: { ...machine.bounds, xMin: parseFloat(e.target.value) || -1200 },
                  })
                }
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[13px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
              />
              <span className="text-slate-300 dark:text-slate-600 font-bold">..</span>
              <input
                type="number"
                value={machine.bounds.xMax}
                onChange={(e) =>
                  updateMachine({
                    bounds: { ...machine.bounds, xMax: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[13px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
              Ось Y (мин..макс)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={machine.bounds.yMin}
                onChange={(e) =>
                  updateMachine({
                    bounds: { ...machine.bounds, yMin: parseFloat(e.target.value) || -900 },
                  })
                }
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[13px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
              />
              <span className="text-slate-300 dark:text-slate-600 font-bold">..</span>
              <input
                type="number"
                value={machine.bounds.yMax}
                onChange={(e) =>
                  updateMachine({
                    bounds: { ...machine.bounds, yMax: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[13px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3b. ПОДЛОЖКА — фоновый референсный чертёж (только на сессию) */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ImagePlus className="w-3.5 h-3.5 text-accent" />
            Подложка
          </span>
          {underlay.src && (
            <button
              type="button"
              onClick={clearUnderlay}
              className="text-[12px] flex items-center gap-1 text-danger hover:opacity-80 font-bold transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Убрать
            </button>
          )}
        </div>

        <p className="text-[12px] text-slate-400 dark:text-slate-500 leading-snug">
          Фоновая картинка-чертёж для обводки. Двигается и растягивается за угол на холсте.
          Видна только в этой сессии и не влияет на G-код.
        </p>

        <label className="block">
          <span className="text-[12px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">Изображение</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleUnderlayFile}
            className="w-full text-[13px] text-slate-600 dark:text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:dark:bg-slate-800 file:px-2 file:py-1.5 file:text-[13px] file:font-bold file:text-slate-700 file:dark:text-slate-200 hover:file:bg-slate-200 hover:file:dark:bg-slate-700 file:transition-colors"
          />
        </label>

        {underlay.src && (
          <>
            <div>
              <label className="text-[12px] text-slate-500 dark:text-slate-400 block mb-1 font-medium flex items-center justify-between">
                <span>Прозрачность</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{Math.round(underlay.opacity * 100)}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(underlay.opacity * 100)}
                onChange={(e) =>
                  updateUnderlay({ opacity: (parseFloat(e.target.value) || 50) / 100 })
                }
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={fitUnderlayToSheet}
              className="w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-700 border border-line rounded-lg px-2 py-1.5 transition-colors"
            >
              <Maximize className="w-3.5 h-3.5" /> Разместить по листу
            </button>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                {underlay.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Показывать
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={underlay.visible}
                  onChange={(e) => updateUnderlay({ visible: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:dark:border-slate-700 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:dark:bg-slate-900 after:border-slate-300 after:dark:border-slate-600 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary" />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                {underlay.frozen ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                Заморозить
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={underlay.frozen}
                  onChange={(e) => updateUnderlay({ frozen: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:dark:border-slate-700 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:dark:bg-slate-900 after:border-slate-300 after:dark:border-slate-600 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-slate-600" />
              </label>
            </div>

            {underlay.frozen && (
              <p className="text-[12px] text-slate-400 dark:text-slate-500 leading-snug">
                Заморожена — картинку нельзя сдвинуть или растянуть на холсте.
              </p>
            )}
          </>
        )}
      </div>

      {/* 4. ОШИБКИ И ПРЕДУПРЕЖДЕНИЯ */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-accent" />
            Проверка безопасности ({warnings.length})
          </span>
        </div>

        {warnings.length === 0 ? (
          <div className="p-3 text-center text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 border border-line rounded-lg space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-100">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
              <span>Все проверки пройдены</span>
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Ошибок и выходов за пределы рабочей зоны станка не обнаружено.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {/* ERRORS */}
            {errors.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-danger/10 border border-danger/30 rounded-lg text-danger space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-danger">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </div>

                  {item.objectId && (
                    <button
                      type="button"
                      onClick={() => setSelectedObjectId(item.objectId || null)}
                      className="text-[12px] bg-danger/15 hover:bg-danger/25 text-danger px-2 py-0.5 rounded font-medium transition-colors shrink-0"
                    >
                      Перейти
                    </button>
                  )}
                </div>
                <p className="text-[12px] text-danger leading-relaxed">{item.message}</p>
              </div>
            ))}

            {/* WARNINGS */}
            {warnList.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-line rounded-lg text-slate-700 dark:text-slate-200 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 dark:text-slate-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </div>

                  {item.objectId && (
                    <button
                      type="button"
                      onClick={() => setSelectedObjectId(item.objectId || null)}
                      className="text-[12px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 hover:dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded font-medium transition-colors shrink-0"
                    >
                      Перейти
                    </button>
                  )}
                </div>
                <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{item.message}</p>
              </div>
            ))}

            {/* INFOS */}
            {infos.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-line rounded-lg text-slate-700 dark:text-slate-200 space-y-1"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 dark:text-slate-200">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

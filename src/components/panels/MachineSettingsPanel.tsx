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
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
            <div className="w-7 h-4 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:dark:border-slate-700 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:dark:bg-slate-900 after:border-slate-300 after:dark:border-slate-600 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500" />
          </label>
        </div>

        {stockSheet.enabled && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-bold focus:border-emerald-500 focus:bg-white focus:dark:bg-slate-800 focus:outline-none cursor-pointer transition-all"
              >
                {widthOptions.map((w) => (
                  <option key={w} value={w}>
                    {w} мм
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-bold focus:border-emerald-500 focus:bg-white focus:dark:bg-slate-800 focus:outline-none cursor-pointer transition-all"
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
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Инструмент и режимы
        </span>

        {/* Диаметр фрезы */}
        <div className="pt-1">
          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
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
              className="w-full bg-amber-50/60 dark:bg-amber-500/15 border border-amber-200/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-900 dark:text-amber-300 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-amber-500 focus:outline-none transition-all"
            />
            <span className="text-slate-400 dark:text-slate-500 font-bold text-xs shrink-0">мм</span>
          </div>
        </div>

        {/* Spindle & Feeds */}
        <div className="space-y-2 pt-1">
          <div>
            <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
              Обороты (об/мин)
            </label>
            <input
              type="number"
              value={machine.spindleSpeed}
              onChange={(e) => updateMachine({ spindleSpeed: parseInt(e.target.value) || 15000 })}
              className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Подача (F cut)
              </label>
              <input
                type="number"
                value={machine.feedCut}
                onChange={(e) => updateMachine({ feedCut: parseFloat(e.target.value) || 1000 })}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-amber-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Врезание (F plunge)
              </label>
              <input
                type="number"
                value={machine.feedPlunge}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 700;
                  updateMachine({ feedPlunge: val, feedDrill: val });
                }}
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-amber-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Высоты Z */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Безопасная Z (мм)
              </label>
              <input
                type="number"
                value={machine.safeZ}
                onChange={(e) => updateMachine({ safeZ: parseFloat(e.target.value) || 20 })}
                className="w-full bg-emerald-50/60 dark:bg-emerald-500/15 border border-emerald-200/80 rounded-lg px-2.5 py-1.5 font-mono font-bold text-emerald-800 dark:text-emerald-400 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
                Глубина реза Z (мм)
              </label>
              <input
                type="number"
                step="0.5"
                value={machine.cutDepth ?? 5}
                onChange={(e) => updateMachine({ cutDepth: parseFloat(e.target.value) || 5 })}
                className="w-full bg-blue-50/60 dark:bg-blue-500/15 border border-blue-200/80 rounded-lg px-2.5 py-1.5 font-mono font-bold text-blue-800 dark:text-blue-400 text-xs focus:bg-white focus:dark:bg-slate-800 focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. РАБОЧАЯ ЗОНА СТАНКА */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          Границы рабочей зоны
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
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
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
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
                className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 dark:text-slate-100 font-bold focus:bg-white focus:dark:bg-slate-800 focus:outline-none transition-all text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3b. ПОДЛОЖКА — фоновый референсный чертёж (только на сессию) */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ImagePlus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Подложка
          </span>
          {underlay.src && (
            <button
              type="button"
              onClick={clearUnderlay}
              className="text-[10px] flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:dark:text-rose-400 font-bold transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Убрать
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
          Фоновая картинка-чертёж для обводки. Двигается и растягивается за угол на холсте.
          Видна только в этой сессии и не влияет на G-код.
        </p>

        <label className="block">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">Изображение</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleUnderlayFile}
            className="w-full text-[11px] text-slate-600 dark:text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-sky-50 file:dark:bg-sky-500/15 file:px-2 file:py-1.5 file:text-[11px] file:font-bold file:text-sky-700 file:dark:text-sky-400 hover:file:bg-sky-100 hover:file:dark:bg-sky-500/20 file:transition-colors"
          />
        </label>

        {underlay.src && (
          <>
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 font-medium flex items-center justify-between">
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
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={fitUnderlayToSheet}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 hover:dark:bg-sky-500/20 border border-sky-200 rounded-lg px-2 py-1.5 transition-colors"
            >
              <Maximize className="w-3.5 h-3.5" /> Разместить по листу
            </button>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
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
                <div className="w-7 h-4 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:dark:border-slate-700 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:dark:bg-slate-900 after:border-slate-300 after:dark:border-slate-600 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500" />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
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
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                Заморожена — картинку нельзя сдвинуть или растянуть на холсте.
              </p>
            )}
          </>
        )}
      </div>

      {/* 4. ОШИБКИ И ПРЕДУПРЕЖДЕНИЯ */}
      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Проверка безопасности ({warnings.length})
          </span>
        </div>

        {warnings.length === 0 ? (
          <div className="p-3 text-center text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/15 border border-emerald-200/80 rounded-lg space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-emerald-800 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Все проверки пройдены</span>
            </div>
            <p className="text-[10px] text-emerald-600/90 dark:text-emerald-400/90">
              Ошибок и выходов за пределы рабочей зоны станка не обнаружено.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {/* ERRORS */}
            {errors.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 rounded-lg text-rose-900 dark:text-rose-300 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </div>

                  {item.objectId && (
                    <button
                      type="button"
                      onClick={() => setSelectedObjectId(item.objectId || null)}
                      className="text-[10px] bg-rose-100 dark:bg-rose-500/15 hover:bg-rose-200 hover:dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 px-2 py-0.5 rounded font-medium transition-colors shrink-0"
                    >
                      Перейти
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-rose-800/90 dark:text-rose-400/90 leading-relaxed">{item.message}</p>
              </div>
            ))}

            {/* WARNINGS */}
            {warnList.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 rounded-lg text-amber-900 dark:text-amber-300 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </div>

                  {item.objectId && (
                    <button
                      type="button"
                      onClick={() => setSelectedObjectId(item.objectId || null)}
                      className="text-[10px] bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 hover:dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded font-medium transition-colors shrink-0"
                    >
                      Перейти
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-amber-800/90 dark:text-amber-400/90 leading-relaxed">{item.message}</p>
              </div>
            ))}

            {/* INFOS */}
            {infos.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 rounded-lg text-blue-900 dark:text-blue-300 space-y-1"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700 dark:text-blue-400">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[10px] text-blue-800/90 dark:text-blue-400/90 leading-relaxed">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

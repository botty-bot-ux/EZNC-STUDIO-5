import React from 'react';
import {
  Shield,
  Square,
  Wrench,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

const WIDTH_OPTIONS = [884, 984, 1284, 1484, 1684, 1884, 2084];
const HEIGHT_OPTIONS = [250, 370, 1084, 1124, 1204];

export const MachineSettingsPanel: React.FC = () => {
  const { machine, updateMachine, warnings, setSelectedObjectId } = useProjectStore();

  const stockSheet = machine.stockSheet || {
    enabled: true,
    preset: '1000x1000',
    widthX: 1000,
    widthY: 1000,
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

  const isPreset3 =
    machine.cutDepth === 17.5 &&
    stockSheet.widthY === 1684 &&
    stockSheet.widthX === 1084 &&
    machine.spindleSpeed === 18000 &&
    machine.feedCut === 2000 &&
    machine.feedPlunge === 700 &&
    machine.feedDrill === 700;

  const isPreset8 =
    machine.cutDepth === 33 &&
    stockSheet.widthY === 2084 &&
    stockSheet.widthX === 370 &&
    machine.spindleSpeed === 15000 &&
    machine.feedCut === 700 &&
    machine.feedPlunge === 700 &&
    machine.feedDrill === 700;

  const applyPreset3 = () => {
    updateMachine({
      cutDepth: 17.5,
      spindleSpeed: 18000,
      feedCut: 2000,
      feedPlunge: 700,
      feedDrill: 700,
      toolDiameter: 3.0,
      stockSheet: {
        enabled: true,
        preset: 'custom',
        widthY: 1684,
        widthX: 1084,
        color: '#22c55e',
      },
    });
  };

  const applyPreset8 = () => {
    updateMachine({
      cutDepth: 33,
      spindleSpeed: 15000,
      feedCut: 700,
      feedPlunge: 700,
      feedDrill: 700,
      toolDiameter: 8.0,
      stockSheet: {
        enabled: true,
        preset: 'custom',
        widthY: 2084,
        widthX: 370,
        color: '#22c55e',
      },
    });
  };

  const errors = warnings.filter((w) => w.level === 'error');
  const warnList = warnings.filter((w) => w.level === 'warning');
  const infos = warnings.filter((w) => w.level === 'info');

  return (
    <div className="p-3 space-y-3 text-xs text-slate-800 overflow-y-auto h-full custom-scrollbar">
      {/* 1. ЗАГОТОВКА ЛИСТА */}
      <div className="bg-white/90 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5 text-emerald-600" />
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
            <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500" />
          </label>
        </div>

        {stockSheet.enabled && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-bold focus:border-emerald-500 focus:bg-white focus:outline-none cursor-pointer transition-all"
              >
                {widthOptions.map((w) => (
                  <option key={w} value={w}>
                    {w} мм
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-bold focus:border-emerald-500 focus:bg-white focus:outline-none cursor-pointer transition-all"
              >
                {heightOptions.map((h) => (
                  <option key={h} value={h}>
                    {h} мм
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. ИНСТРУМЕНТ И РЕЖИМЫ */}
      <div className="bg-white/90 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-amber-600" />
          Инструмент и режимы
        </span>

        {/* Быстрые шаблоны */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-lg">
          <button
            type="button"
            onClick={applyPreset3}
            className={`py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
              isPreset3
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Фреза 3 мм
          </button>
          <button
            type="button"
            onClick={applyPreset8}
            className={`py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
              isPreset8
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Фреза 8 мм
          </button>
        </div>

        {/* Spindle & Feeds */}
        <div className="space-y-2 pt-1">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
              Обороты (об/мин)
            </label>
            <input
              type="number"
              value={machine.spindleSpeed}
              onChange={(e) => updateMachine({ spindleSpeed: parseInt(e.target.value) || 15000 })}
              className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 text-xs focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                Подача (F cut)
              </label>
              <input
                type="number"
                value={machine.feedCut}
                onChange={(e) => updateMachine({ feedCut: parseFloat(e.target.value) || 1000 })}
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 text-xs focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                Врезание (F plunge)
              </label>
              <input
                type="number"
                value={machine.feedPlunge}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 700;
                  updateMachine({ feedPlunge: val, feedDrill: val });
                }}
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 text-xs focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Высоты Z */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                Безопасная Z (мм)
              </label>
              <input
                type="number"
                value={machine.safeZ}
                onChange={(e) => updateMachine({ safeZ: parseFloat(e.target.value) || 20 })}
                className="w-full bg-emerald-50/60 border border-emerald-200/80 rounded-lg px-2.5 py-1.5 font-mono font-bold text-emerald-800 text-xs focus:bg-white focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
                Глубина реза Z (мм)
              </label>
              <input
                type="number"
                step="0.5"
                value={machine.cutDepth ?? 5}
                onChange={(e) => updateMachine({ cutDepth: parseFloat(e.target.value) || 5 })}
                className="w-full bg-blue-50/60 border border-blue-200/80 rounded-lg px-2.5 py-1.5 font-mono font-bold text-blue-800 text-xs focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. РАБОЧАЯ ЗОНА СТАНКА */}
      <div className="bg-white/90 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-purple-600" />
          Границы рабочей зоны
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 font-bold focus:bg-white focus:outline-none transition-all text-center"
              />
              <span className="text-slate-300 font-bold">..</span>
              <input
                type="number"
                value={machine.bounds.xMax}
                onChange={(e) =>
                  updateMachine({
                    bounds: { ...machine.bounds, xMax: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 font-bold focus:bg-white focus:outline-none transition-all text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">
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
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 font-bold focus:bg-white focus:outline-none transition-all text-center"
              />
              <span className="text-slate-300 font-bold">..</span>
              <input
                type="number"
                value={machine.bounds.yMax}
                onChange={(e) =>
                  updateMachine({
                    bounds: { ...machine.bounds, yMax: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full bg-slate-100/80 border border-slate-200/90 rounded-lg px-1.5 py-1 font-mono text-[11px] text-slate-800 font-bold focus:bg-white focus:outline-none transition-all text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. ОШИБКИ И ПРЕДУПРЕЖДЕНИЯ */}
      <div className="bg-white/90 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Проверка безопасности ({warnings.length})
          </span>
        </div>

        {warnings.length === 0 ? (
          <div className="p-3 text-center text-emerald-700 bg-emerald-50/80 border border-emerald-200/80 rounded-lg space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Все проверки пройдены</span>
            </div>
            <p className="text-[10px] text-emerald-600/90">
              Ошибок и выходов за пределы рабочей зоны станка не обнаружено.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {/* ERRORS */}
            {errors.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </div>

                  {item.objectId && (
                    <button
                      type="button"
                      onClick={() => setSelectedObjectId(item.objectId || null)}
                      className="text-[10px] bg-rose-100 hover:bg-rose-200 text-rose-800 px-2 py-0.5 rounded font-medium transition-colors shrink-0"
                    >
                      Перейти
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-rose-800/90 leading-relaxed">{item.message}</p>
              </div>
            ))}

            {/* WARNINGS */}
            {warnList.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </div>

                  {item.objectId && (
                    <button
                      type="button"
                      onClick={() => setSelectedObjectId(item.objectId || null)}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-medium transition-colors shrink-0"
                    >
                      Перейти
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-amber-800/90 leading-relaxed">{item.message}</p>
              </div>
            ))}

            {/* INFOS */}
            {infos.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[10px] text-blue-800/90 leading-relaxed">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

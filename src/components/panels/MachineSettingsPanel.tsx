import React from 'react';
import {
  Shield,
  Square,
  Wrench,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

const SHEET_PRESETS = [
  { id: 'none', label: '❌ Без заготовки (Скрыть)', x: 0, y: 0 },
  { id: '1000x1000', label: '1000 × 1000 мм', x: 1000, y: 1000 },
  { id: '1500x1500', label: '1500 × 1500 мм', x: 1500, y: 1500 },
  { id: '2000x1000', label: '2000 × 1000 мм', x: 2000, y: 1000 },
  { id: '2440x1220', label: '2440 × 1220 мм (Фанера/МДФ)', x: 2440, y: 1220 },
  { id: '2500x1250', label: '2500 × 1250 мм', x: 2500, y: 1250 },
  { id: '2800x2070', label: '2800 × 2070 мм (ЛДСП)', x: 2800, y: 2070 },
  { id: '3000x1500', label: '3000 × 1500 мм', x: 3000, y: 1500 },
  { id: 'custom', label: '✏️ Свой размер...', x: 1000, y: 1000 },
];

export const MachineSettingsPanel: React.FC = () => {
  const { machine, updateMachine } = useProjectStore();

  const stockSheet = machine.stockSheet || {
    enabled: true,
    preset: '1000x1000',
    widthX: 1000,
    widthY: 1000,
    color: '#f59e0b',
  };

  const currentPresetVal = !stockSheet.enabled
    ? 'none'
    : stockSheet.preset || '1000x1000';

  return (
    <div className="p-4 space-y-5 text-xs text-slate-800 overflow-y-auto h-full">
      {/* 1. WORK OFFSETS */}
      <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
        <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">
          Смещение Рабочего Нуля (Offset)
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-500 block mb-1">Смещение X (Offset X)</label>
            <input
              type="number"
              value={machine.workOffset.x}
              onChange={(e) => updateMachine({ workOffset: { ...machine.workOffset, x: parseFloat(e.target.value) || 0 } })}
              className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Смещение Y (Offset Y)</label>
            <input
              type="number"
              value={machine.workOffset.y}
              onChange={(e) => updateMachine({ workOffset: { ...machine.workOffset, y: parseFloat(e.target.value) || 0 } })}
              className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* 2. MACHINE BOUNDS & SAFETY */}
      <div className="space-y-3 pt-2 border-t border-slate-200/80">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Рабочая Зона и Безопасность Z</span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Начало координат (0,0) находится в правом нижнем углу. Ось -X направлена вверх, ось -Y — влево.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-500 block mb-1">Зона X (мин..макс)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={machine.bounds.xMin}
                onChange={(e) =>
                  updateMachine({ bounds: { ...machine.bounds, xMin: parseFloat(e.target.value) || -1200 } })
                }
                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2 py-1 font-mono text-[11px] text-slate-800 focus:bg-white transition-all"
              />
              <span className="text-slate-400">..</span>
              <input
                type="number"
                value={machine.bounds.xMax}
                onChange={(e) =>
                  updateMachine({ bounds: { ...machine.bounds, xMax: parseFloat(e.target.value) || 0 } })
                }
                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2 py-1 font-mono text-[11px] text-slate-800 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Зона Y (мин..макс)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={machine.bounds.yMin}
                onChange={(e) =>
                  updateMachine({ bounds: { ...machine.bounds, yMin: parseFloat(e.target.value) || -900 } })
                }
                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2 py-1 font-mono text-[11px] text-slate-800 focus:bg-white transition-all"
              />
              <span className="text-slate-400">..</span>
              <input
                type="number"
                value={machine.bounds.yMax}
                onChange={(e) =>
                  updateMachine({ bounds: { ...machine.bounds, yMax: parseFloat(e.target.value) || 0 } })
                }
                className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2 py-1 font-mono text-[11px] text-slate-800 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-500 block font-medium">Безопасная Z (мм)</label>
          </div>
          <input
            type="number"
            value={machine.safeZ}
            onChange={(e) => updateMachine({ safeZ: parseFloat(e.target.value) || 10 })}
            className="w-full bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-emerald-700 font-bold focus:bg-white transition-all"
          />
          <span className="text-[10px] text-slate-400 block mt-1 leading-tight">
            Высота быстрых переездов над струбцинами и заготовкой
          </span>
        </div>
      </div>

      {/* 3. STOCK SHEET TEMPLATES / ЗАГОТОВКА ЛИСТА */}
      <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-amber-700 text-xs">
            <Square className="w-4 h-4" />
            <span>Шаблон Листа Заготовки</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={stockSheet.enabled && stockSheet.preset !== 'none'}
              onChange={(e) =>
                updateMachine({
                  stockSheet: {
                    ...stockSheet,
                    enabled: e.target.checked,
                    preset: e.target.checked
                      ? stockSheet.preset === 'none'
                        ? '1000x1000'
                        : stockSheet.preset
                      : 'none',
                  },
                })
              }
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <p className="text-[11px] text-slate-400 leading-tight">
          Отображение контура листа материала пунктиром другого цвета в редакторе.
        </p>

        {/* PRESET SELECT DROPDOWN */}
        <div>
          <label className="text-slate-400 block mb-1 font-medium text-[11px]">Выберите шаблон листа</label>
          <select
            value={currentPresetVal}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'none') {
                updateMachine({
                  stockSheet: {
                    ...stockSheet,
                    enabled: false,
                    preset: 'none',
                  },
                });
                return;
              }

              const presetObj = SHEET_PRESETS.find((p) => p.id === val);
              if (presetObj && val !== 'custom') {
                updateMachine({
                  stockSheet: {
                    enabled: true,
                    preset: val,
                    widthX: presetObj.x,
                    widthY: presetObj.y,
                    color: stockSheet.color || '#f59e0b',
                  },
                });
              } else {
                updateMachine({
                  stockSheet: {
                    enabled: true,
                    preset: 'custom',
                    widthX: stockSheet.widthX || 1000,
                    widthY: stockSheet.widthY || 1000,
                    color: stockSheet.color || '#f59e0b',
                  },
                });
              }
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-amber-200 font-medium focus:border-amber-500 focus:outline-none cursor-pointer"
          >
            {SHEET_PRESETS.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* DIMENSIONS & COLOR SELECTION IF ENABLED */}
        {stockSheet.enabled && stockSheet.preset !== 'none' && (
          <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">Длина X (мм)</label>
                <input
                  type="number"
                  value={stockSheet.widthX}
                  onChange={(e) =>
                    updateMachine({
                      stockSheet: {
                        ...stockSheet,
                        preset: 'custom',
                        widthX: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-[11px] text-amber-300 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">Ширина Y (мм)</label>
                <input
                  type="number"
                  value={stockSheet.widthY}
                  onChange={(e) =>
                    updateMachine({
                      stockSheet: {
                        ...stockSheet,
                        preset: 'custom',
                        widthY: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-[11px] text-amber-300 font-bold"
                />
              </div>
            </div>

            {/* COLOR ACCENT PICKER FOR DASHED LINE */}
            <div>
              <label className="text-slate-400 block mb-1.5 text-[10px]">Цвет пунктирной линии</label>
              <div className="flex items-center gap-2">
                {[
                  { color: '#f59e0b', name: 'Оранжевый' },
                  { color: '#a855f7', name: 'Фиолетовый' },
                  { color: '#ec4899', name: 'Розовый' },
                  { color: '#10b981', name: 'Изумрудный' },
                  { color: '#06b6d4', name: 'Бирюзовый' },
                  { color: '#eab308', name: 'Желтый' },
                ].map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    title={item.name}
                    onClick={() =>
                      updateMachine({
                        stockSheet: {
                          ...stockSheet,
                          color: item.color,
                        },
                      })
                    }
                    className={`w-5 h-5 rounded-full transition-transform border ${
                      (stockSheet.color || '#f59e0b') === item.color
                        ? 'ring-2 ring-white scale-110 border-transparent'
                        : 'border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: item.color }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. TOOL, SPINDLE & FEEDS */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5 font-bold text-slate-300">
          <Wrench className="w-4 h-4 text-blue-400" />
          <span>Инструмент и Подачи</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-400 block mb-1">Диаметр фрезы (мм)</label>
            <input
              type="number"
              step="0.001"
              value={machine.toolDiameter}
              onChange={(e) => updateMachine({ toolDiameter: parseFloat(e.target.value) || 3.175 })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-amber-300"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Обороты шпинделя (об/мин)</label>
            <input
              type="number"
              value={machine.spindleSpeed}
              onChange={(e) => updateMachine({ spindleSpeed: parseInt(e.target.value) || 15000 })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-yellow-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-slate-400 block mb-1 text-[10px]">Подача резания</label>
            <input
              type="number"
              value={machine.feedCut}
              onChange={(e) => updateMachine({ feedCut: parseFloat(e.target.value) || 1000 })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 text-[10px]">Подача врезания Z</label>
            <input
              type="number"
              value={machine.feedPlunge}
              onChange={(e) => updateMachine({ feedPlunge: parseFloat(e.target.value) || 300 })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 text-[10px]">Подача сверления</label>
            <input
              type="number"
              value={machine.feedDrill}
              onChange={(e) => updateMachine({ feedDrill: parseFloat(e.target.value) || 500 })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-[11px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

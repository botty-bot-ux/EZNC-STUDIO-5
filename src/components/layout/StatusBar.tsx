import React from 'react';
import { AlertCircle, CheckCircle2, Crosshair, Wrench, Zap } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { transformProgramToMachine, isPointWithinBounds } from '../../lib/geometry/transform';

interface StatusBarProps {
  cursorProgramPos: { x: number; y: number } | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ cursorProgramPos }) => {
  const { machine, warnings, viewMode } = useProjectStore();

  const progX = cursorProgramPos ? cursorProgramPos.x.toFixed(2) : '0.00';
  const progY = cursorProgramPos ? cursorProgramPos.y.toFixed(2) : '0.00';

  const machPt = cursorProgramPos
    ? transformProgramToMachine(cursorProgramPos, machine)
    : transformProgramToMachine({ x: 0, y: 0 }, machine);

  const machX = machPt.x.toFixed(2);
  const machY = machPt.y.toFixed(2);

  const inBounds = cursorProgramPos ? isPointWithinBounds(machPt, machine) : true;

  const errorCount = warnings.filter((w) => w.level === 'error').length;

  return (
    <footer className="h-8 bg-white/70 backdrop-blur-xl border-t border-slate-200/80 text-slate-600 text-xs px-4 flex items-center justify-between select-none shrink-0 font-mono shadow-sm">
      {/* Left side: Coordinates */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-slate-400">ПРОГР:</span>
          <span className="text-slate-800 font-semibold w-24">
            X:{progX} Y:{progY}
          </span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-slate-300/80 pl-3">
          <span className="text-slate-400">СТАНОК:</span>
          <span className={`w-28 font-semibold ${inBounds ? 'text-emerald-600' : 'text-rose-600 font-bold'}`}>
            X:{machX} Y:{machY}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-300/80 pl-3">
          {inBounds ? (
            <span className="flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              В ЗОНЕ
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-600 text-[11px] font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              ВНЕ ЗОНЫ СТАНКА
            </span>
          )}
        </div>
      </div>

      {/* Right side: Machine specs & status */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-slate-500">Инструмент:</span>
          <span className="text-slate-800 font-medium">{machine.toolName} ({machine.toolDiameter}мм)</span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 border-l border-slate-300/80 pl-3">
          <Zap className="w-3.5 h-3.5 text-yellow-600" />
          <span className="text-slate-500">Шпиндель:</span>
          <span className="text-slate-800 font-medium">{machine.spindleSpeed} об/мин</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-slate-300/80 pl-3">
          <span className="text-slate-400">Контроллер:</span>
          <span className="text-blue-600 uppercase font-bold">{machine.controllerProfile}</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-slate-300/80 pl-3">
          <span className="text-slate-400">Режим:</span>
          <span className="text-amber-700 font-semibold">
            {viewMode === 'edit' ? 'Редактирование' : viewMode === 'preview' ? 'Симуляция' : 'Код'}
          </span>
        </div>
      </div>
    </footer>
  );
};

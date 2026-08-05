import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

export const WarningsPanel: React.FC = () => {
  const { warnings, setSelectedObjectId } = useProjectStore();

  const errors = warnings.filter((w) => w.level === 'error');
  const warnList = warnings.filter((w) => w.level === 'warning');
  const infos = warnings.filter((w) => w.level === 'info');

  return (
    <div className="p-4 space-y-4 text-xs text-slate-800 overflow-y-auto h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <span className="font-bold text-sm text-slate-800">
          Проверка Безопасности и Предупреждения ({warnings.length})
        </span>
      </div>

      {warnings.length === 0 ? (
        <div className="p-6 text-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 shadow-sm">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
          <p className="font-bold">Все проверки пройдены!</p>
          <p className="text-[11px] text-emerald-600/80">
            Ошибок и выходов за пределы рабочей зоны станка не обнаружено.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* ERRORS */}
          {errors.map((item) => (
            <div
              key={item.id}
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{item.title}</span>
                </div>

                {item.objectId && (
                  <button
                    onClick={() => setSelectedObjectId(item.objectId || null)}
                    className="text-[10px] bg-rose-100 hover:bg-rose-200 text-rose-800 px-2.5 py-1 rounded-lg font-medium transition-colors"
                  >
                    Перейти
                  </button>
                )}
              </div>
              <p className="text-[11px] text-rose-800/90 leading-relaxed">{item.message}</p>
            </div>
          ))}

          {/* WARNINGS */}
          {warnList.map((item) => (
            <div
              key={item.id}
              className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{item.title}</span>
                </div>

                {item.objectId && (
                  <button
                    onClick={() => setSelectedObjectId(item.objectId || null)}
                    className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2.5 py-1 rounded-lg font-medium transition-colors"
                  >
                    Перейти
                  </button>
                )}
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">{item.message}</p>
            </div>
          ))}

          {/* INFOS */}
          {infos.map((item) => (
            <div
              key={item.id}
              className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1 shadow-sm"
            >
              <div className="flex items-center gap-1.5 font-bold text-blue-700">
                <Info className="w-4 h-4 shrink-0" />
                <span>{item.title}</span>
              </div>
              <p className="text-[11px] text-blue-800/90 leading-relaxed">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { ChevronLeft, Shapes } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { FiguresList } from './FiguresList';
import { useIsMobile } from '../../hooks/useIsMobile';

// Левая панель — простой текстовый список фигур на прозрачном фоне.
// Выбранная фигура синим; её свойства (координаты, Ø, глубина) — на правой панели «Свойства».
// На мобильных фигуры живут в нижней шторке «Фигуры» (см. MobileTabBar), поэтому панель скрывается.
export const LeftToolbar: React.FC = () => {
  const isMobile = useIsMobile();
  const { objects, leftPanelOpen, toggleLeftPanel } = useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      leftPanelOpen: s.leftPanelOpen,
      toggleLeftPanel: s.toggleLeftPanel,
    }))
  );

  if (isMobile) return null;

  if (!leftPanelOpen) {
    return (
      <div className="absolute left-4 top-20 z-20 flex items-center select-none pointer-events-auto">
        <button
          onClick={toggleLeftPanel}
          title="Показать список фигур"
          className="relative w-11 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-md flex items-center justify-center cursor-pointer hover:bg-white hover:dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:dark:text-blue-400 transition-colors"
        >
          <Shapes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          {objects.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center border-2 border-white dark:border-slate-700 shadow-sm">
              {objects.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <aside className="absolute left-4 top-20 bottom-4 w-72 flex flex-col bg-transparent text-slate-800 dark:text-slate-100 z-20 select-none overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="px-1.5 py-1 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Shapes className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Фигуры</span>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{objects.length}</span>
        </div>

        <button
          onClick={toggleLeftPanel}
          title="Свернуть панель"
          className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100 hover:bg-slate-500/10 hover:dark:bg-slate-500/10 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Figures list */}
      <div className="flex-1 min-h-0">
        <FiguresList />
      </div>
    </aside>
  );
};

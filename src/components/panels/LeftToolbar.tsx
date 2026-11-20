import React, { useState } from 'react';
import { ChevronLeft, Search, Shapes, X, Zap } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { FiguresList } from './FiguresList';
import { useIsMobile } from '../../hooks/useIsMobile';

export const LeftToolbar: React.FC = () => {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const {
    objects,
    selectedObjectIds,
    leftPanelOpen,
    toggleLeftPanel,
    optimizeRoute,
    selectAllObjects,
  } = useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      leftPanelOpen: s.leftPanelOpen,
      toggleLeftPanel: s.toggleLeftPanel,
      optimizeRoute: s.optimizeRoute,
      selectAllObjects: s.selectAllObjects,
    }))
  );

  if (isMobile || !leftPanelOpen) return null;

  return (
    <aside
      aria-label="Список деталей и порядок резки"
      className="w-[252px] shrink-0 flex flex-col bg-surface border-r border-line text-fg z-10 select-none overflow-hidden"
    >
      {/* Шапка списка деталей */}
      <div className="px-3 py-2 bg-surface-subtle border-b border-line flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Shapes className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="text-xs font-semibold text-fg truncate">Список деталей</span>
          <span className="font-mono tabular-nums text-xs text-muted">· {objects.length}</span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {objects.length > 1 && (
            <button
              type="button"
              onClick={() => optimizeRoute()}
              title="Оптимизировать порядок резки (меньше холостых переходов)"
              className="p-1 rounded-md text-muted hover:text-accent hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleLeftPanel}
            title="Свернуть список деталей"
            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Быстрый поиск при большом числе объектов */}
      {objects.length >= 6 && (
        <div className="px-2 py-1.5 border-b border-line bg-surface shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Фильтр по названию…"
              className="w-full bg-surface-subtle border border-line rounded-md pl-7 pr-6 py-1 text-xs text-fg placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Очистить фильтр"
                className="absolute right-1.5 p-0.5 text-muted hover:text-fg cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Список объектов */}
      <div className="flex-1 min-h-0">
        <FiguresList filterQuery={searchQuery} />
      </div>

      {/* Нижняя панель быстрых действий маршрута */}
      {objects.length > 0 && (
        <div className="px-3 py-1.5 bg-surface-subtle border-t border-line flex items-center justify-between text-[11px] text-muted shrink-0">
          <span className="font-mono">
            {selectedObjectIds.length > 0
              ? `Выбрано: ${selectedObjectIds.length}`
              : `Всего: ${objects.length}`}
          </span>
          <button
            type="button"
            onClick={selectAllObjects}
            className="font-medium text-fg-secondary hover:text-fg transition-colors cursor-pointer"
          >
            Выделить все
          </button>
        </div>
      )}
    </aside>
  );
};

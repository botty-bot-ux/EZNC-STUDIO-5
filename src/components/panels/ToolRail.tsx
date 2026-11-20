import React from 'react';
import {
  FileUp,
  Maximize2,
  PanelLeft,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { isRailMachine } from '../../store/initialState';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getToolDefs } from '../layout/toolDefs';

export const ToolRail: React.FC = () => {
  const isMobile = useIsMobile();
  const {
    activeTool,
    setActiveTool,
    renderMode,
    machine,
    leftPanelOpen,
    toggleLeftPanel,
    objects,
    requestFitView,
    setShapeDialog,
  } = useProjectStore(
    useShallow((s) => ({
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      renderMode: s.renderMode,
      machine: s.machine,
      leftPanelOpen: s.leftPanelOpen,
      toggleLeftPanel: s.toggleLeftPanel,
      objects: s.objects,
      requestFitView: s.requestFitView,
      setShapeDialog: s.setShapeDialog,
    }))
  );

  if (isMobile) return null;

  const tools = getToolDefs(isRailMachine(machine));

  return (
    <aside
      aria-label="Панель инструментов"
      className="w-[68px] bg-surface border-r border-line flex flex-col items-center justify-between py-2 px-1.5 select-none shrink-0 z-20 overflow-y-auto no-scrollbar"
    >
      {/* Верхний блок: инструменты 2D-черчения с понятными подписями */}
      <div className="flex flex-col items-center gap-0.5 w-full">
        {renderMode === '2d' ? (
          <>
            {tools.map(({ id, Icon, label, shortLabel, title }) => {
              const active = activeTool === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTool(id)}
                  title={title}
                  aria-label={label}
                  aria-pressed={active}
                  className={`w-full py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    active
                      ? 'bg-primary text-primary-fg shadow-2xs'
                      : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="w-[17px] h-[17px] shrink-0" />
                  <span
                    className={`text-[10px] leading-none font-medium truncate max-w-full ${
                      active ? 'text-primary-fg font-semibold' : 'text-muted'
                    }`}
                  >
                    {shortLabel}
                  </span>
                </button>
              );
            })}

            <div className="w-8 h-px bg-line my-1.5" />

            <button
              type="button"
              onClick={requestFitView}
              title="Вписать рабочую зону в экран (F)"
              aria-label="Вписать рабочую зону в экран"
              className="w-full py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-1 text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4 shrink-0" />
              <span className="text-[10px] leading-none font-medium text-muted">Вписать</span>
            </button>

            <button
              type="button"
              onClick={() => setShapeDialog({ kind: 'import' })}
              title="Импорт контуров из DXF или SVG"
              aria-label="Импорт DXF / SVG"
              className="w-full py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-1 text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <FileUp className="w-4 h-4 shrink-0" />
              <span className="text-[10px] leading-none font-medium text-muted">Импорт</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 pt-1">
            <span
              title="Режим 3D-симуляции"
              className="font-mono text-[10px] font-bold text-muted tracking-tight px-1.5 py-1 rounded bg-surface-subtle border border-line"
            >
              3D
            </span>
          </div>
        )}
      </div>

      {/* Нижний блок: переключение панели «Список деталей» */}
      <div className="flex flex-col items-center gap-1 w-full pt-2 mt-2 border-t border-line shrink-0">
        <button
          type="button"
          onClick={toggleLeftPanel}
          title={leftPanelOpen ? 'Свернуть список деталей' : 'Показать список деталей'}
          aria-label={leftPanelOpen ? 'Свернуть список деталей' : 'Показать список деталей'}
          aria-pressed={leftPanelOpen}
          className={`w-full py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
            leftPanelOpen
              ? 'bg-accent/12 text-accent hover:bg-accent/18'
              : 'text-fg-secondary hover:text-fg hover:bg-surface-hover'
          }`}
        >
          <PanelLeft className="w-4 h-4 shrink-0" />
          <span className="text-[10px] leading-none font-medium whitespace-nowrap">
            {objects.length > 0 ? `Детали ${objects.length}` : 'Детали'}
          </span>
        </button>
      </div>
    </aside>
  );
};

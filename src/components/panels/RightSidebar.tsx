import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code,
  Compass,
  SlidersHorizontal,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useProjectStore } from '../../store/useProjectStore';
import { GcodeEditor } from '../editor/GcodeEditor';
import { useResizablePanel } from '../ui/useResizablePanel';
import { InspectorStatusBar } from './InspectorStatusBar';
import { MachineSettingsPanel } from './MachineSettingsPanel';
import { PropertiesPanel } from './PropertiesPanel';

export const RightSidebar: React.FC = () => {
  const isMobile = useIsMobile();
  const {
    activeTab,
    setActiveTab,
    warnings,
    rightPanelOpen,
    toggleRightPanel,
    selectedObjectIds,
    activeTool,
    openSafetyDrawer,
  } = useProjectStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      warnings: s.warnings,
      rightPanelOpen: s.rightPanelOpen,
      toggleRightPanel: s.toggleRightPanel,
      selectedObjectIds: s.selectedObjectIds,
      activeTool: s.activeTool,
      openSafetyDrawer: s.openSafetyDrawer,
    }))
  );

  const isGcodeMode = activeTab === 'gcode';
  const { width, resizing, handleProps } = useResizablePanel(isGcodeMode ? 'gcode' : 'inspector');

  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;

  const [gcodeSeen, setGcodeSeen] = React.useState(isGcodeMode);
  React.useEffect(() => {
    if (isGcodeMode) setGcodeSeen(true);
  }, [isGcodeMode]);

  if (isMobile) return null;

  const openInspectorMode = () => {
    const hasContext = selectedObjectIds.length > 0 || activeTool === 'measure';
    setActiveTab(hasContext ? 'properties' : 'machine');
  };

  if (!rightPanelOpen) {
    return (
      <aside
        aria-label="Свёрнутый инспектор"
        className="w-11 bg-surface border-l border-line flex flex-col items-center justify-between py-2.5 select-none shrink-0 z-20"
      >
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={toggleRightPanel}
            title="Развернуть инспектор"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer mb-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={openInspectorMode}
            title="Инспектор (свойства выделения или лист)"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeTab === 'properties'
                ? 'bg-surface-subtle text-fg border border-line'
                : 'text-muted hover:text-fg hover:bg-surface-hover'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('machine')}
            title="Лист ДСП и настройки станка"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeTab === 'machine'
                ? 'bg-surface-subtle text-fg border border-line'
                : 'text-muted hover:text-fg hover:bg-surface-hover'
            }`}
          >
            <Compass className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gcode')}
            title="Редактор G-кода"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeTab === 'gcode'
                ? 'bg-surface-subtle text-fg border border-line'
                : 'text-muted hover:text-fg hover:bg-surface-hover'
            }`}
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        {/* Нижний индикатор проверки безопасности на свёрнутой панели */}
        <button
          type="button"
          onClick={openSafetyDrawer}
          title={
            errorCount > 0
              ? `Ошибок безопасности: ${errorCount} (открыть)`
              : warningCount > 0
              ? `Предупреждений: ${warningCount} (открыть)`
              : 'Проверка безопасности пройдена'
          }
          className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            errorCount > 0
              ? 'text-danger hover:bg-danger/10'
              : warningCount > 0
              ? 'text-warning hover:bg-warning/10'
              : 'text-success hover:bg-surface-hover'
          }`}
        >
          {errorCount > 0 ? (
            <AlertCircle className="w-4 h-4" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {(errorCount > 0 || warningCount > 0) && (
            <span className="absolute -top-0.5 -right-0.5 font-mono text-[9px] font-bold bg-surface px-0.5 rounded">
              {errorCount > 0 ? errorCount : warningCount}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Инспектор и редактор G-кода"
      style={{ width }}
      className="relative shrink-0 bg-surface border-l border-line text-fg flex flex-col select-none z-10 overflow-hidden"
    >
      {/* Левая граница для перетаскивания ширины (двойной клик — сброс) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину панели (двойной клик — сброс)"
        title="Потяните для изменения ширины · двойной клик — сбросить"
        {...handleProps}
        className={`group absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 z-30 cursor-col-resize touch-none transition-colors ${
          resizing ? 'bg-accent/55' : 'hover:bg-accent/35'
        }`}
      />

      {/* Шапка: 2 режима («Инспектор» и «G-код») + кнопка сворачивания */}
      <div className="px-2.5 py-2 bg-surface-subtle border-b border-line flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-0.5 bg-canvas p-0.5 rounded-lg border border-line flex-1 min-w-0">
          <button
            type="button"
            onClick={openInspectorMode}
            title="Контекстный инспектор: выбранная фигура или настройки листа и станка"
            className={`flex-1 py-1 px-2.5 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              !isGcodeMode
                ? 'bg-surface text-fg font-semibold shadow-2xs'
                : 'text-muted hover:text-fg'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>Инспектор</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gcode')}
            title="Редактор управляющей программы (G-код)"
            className={`flex-1 py-1 px-2.5 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isGcodeMode
                ? 'bg-surface text-fg font-semibold shadow-2xs'
                : 'text-muted hover:text-fg'
            }`}
          >
            <Code className="w-3.5 h-3.5 shrink-0" />
            <span>G-код</span>
          </button>
        </div>

        <button
          type="button"
          onClick={toggleRightPanel}
          title="Свернуть инспектор"
          className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors shrink-0 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Контент активного режима */}
      <div className="flex-1 overflow-hidden bg-surface min-h-0 flex flex-col">
        {activeTab === 'properties' && <PropertiesPanel />}
        {activeTab === 'machine' && <MachineSettingsPanel />}
        {gcodeSeen && (
          <div className={isGcodeMode ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
            <GcodeEditor />
          </div>
        )}
      </div>

      {/* Постоянный статус-бар безопасности и живая сводка УП */}
      <InspectorStatusBar />
    </aside>
  );
};

import React from 'react';
import { ChevronRight, Code, Compass, Sliders, SlidersHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { MachineSettingsPanel } from './MachineSettingsPanel';
import { GcodeEditor } from '../editor/GcodeEditor';
import { PropertiesPanel } from './PropertiesPanel';
import { useIsMobile } from '../../hooks/useIsMobile';

export const RightSidebar: React.FC = () => {
  const isMobile = useIsMobile();
  const { activeTab, setActiveTab, warnings, rightPanelOpen, toggleRightPanel } = useProjectStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      warnings: s.warnings,
      rightPanelOpen: s.rightPanelOpen,
      toggleRightPanel: s.toggleRightPanel,
    }))
  );

  const errorCount = warnings.filter((w) => w.level === 'error').length;

  // Monaco держим смонтированным после первого открытия вкладки G-кода (см. контент ниже).
  const [gcodeSeen, setGcodeSeen] = React.useState(false);
  React.useEffect(() => {
    if (activeTab === 'gcode') setGcodeSeen(true);
  }, [activeTab]);

  // На мобильных те же панели живут в нижней шторке (MobileTabBar + App).
  if (isMobile) return null;

  if (!rightPanelOpen) {
    return (
      <button
        onClick={toggleRightPanel}
        title="Открыть панель свойств и станка"
        className="absolute right-4 top-4 z-20 w-11 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-900/15 flex items-center justify-center cursor-pointer hover:bg-white hover:dark:bg-slate-800 transition-all text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:dark:text-blue-400 hover:scale-105 active:scale-95"
      >
        <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </button>
    );
  }

  // Fixed balanced panel width for all tabs
  const panelWidthClass = 'w-96 md:w-[420px]';

  return (
    <aside className={`absolute right-4 top-4 bottom-4 ${panelWidthClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-900/15 text-slate-800 dark:text-slate-100 flex flex-col select-none z-20 overflow-hidden transition-all duration-200`}>
      {/* Top Header / Collapse Bar */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between shrink-0">
        <button
          onClick={toggleRightPanel}
          title="Свернуть панель"
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100 hover:bg-slate-200/60 hover:dark:bg-slate-600/60 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {activeTab === 'gcode'
            ? 'Редактор G-кода'
            : activeTab === 'properties'
            ? 'Свойства'
            : 'Параметры станка'}
        </span>
      </div>

      {/* Tabs bar */}
      <div className="grid grid-cols-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80 p-1 gap-1 text-[11px] font-semibold shrink-0">
        <button
          onClick={() => setActiveTab('properties')}
          title="Свойства выбранной фигуры"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'properties'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:dark:text-slate-100 hover:bg-slate-50 hover:dark:bg-slate-800/60'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Свойства</span>
        </button>

        <button
          onClick={() => setActiveTab('gcode')}
          title="Редактор G-кода"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'gcode'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:dark:text-slate-100 hover:bg-slate-50 hover:dark:bg-slate-800/60'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>G-код</span>
        </button>

        <button
          onClick={() => setActiveTab('machine')}
          title="Настройки станка"
          className={`relative py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'machine'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:dark:text-slate-100 hover:bg-slate-50 hover:dark:bg-slate-800/60'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Станок</span>

          {errorCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* Tab content area */}
      <div className="flex-1 overflow-hidden bg-slate-50/40 dark:bg-slate-900/40 min-h-0 flex flex-col">
        {activeTab === 'properties' && <PropertiesPanel />}
        {activeTab === 'machine' && <MachineSettingsPanel />}
        {gcodeSeen && (
          <div className={activeTab === 'gcode' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
            <GcodeEditor />
          </div>
        )}
      </div>
    </aside>
  );
};

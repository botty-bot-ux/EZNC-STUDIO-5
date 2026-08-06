import React from 'react';
import { AlertTriangle, ChevronRight, Code, Compass, Sliders } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PropertiesPanel } from './PropertiesPanel';
import { MachineSettingsPanel } from './MachineSettingsPanel';
import { WarningsPanel } from './WarningsPanel';
import { GcodeEditor } from '../editor/GcodeEditor';

export const RightSidebar: React.FC = () => {
  const { activeTab, setActiveTab, warnings, rightPanelOpen, toggleRightPanel } = useProjectStore();

  const errorCount = warnings.filter((w) => w.level === 'error').length;

  if (!rightPanelOpen) {
    return (
      <button
        onClick={toggleRightPanel}
        title="Открыть панель свойств и станка"
        className="absolute right-4 top-4 z-20 w-11 h-11 bg-white/90 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-2xl shadow-slate-900/15 flex items-center justify-center cursor-pointer hover:bg-white transition-all text-slate-700 hover:text-blue-600 hover:scale-105 active:scale-95"
      >
        <Sliders className="w-5 h-5 text-blue-600" />
      </button>
    );
  }

  // Make panel wider when G-code editor tab is active for comfortable code viewing
  const panelWidthClass = activeTab === 'gcode' ? 'w-96 md:w-[480px] xl:w-[540px]' : 'w-80';

  return (
    <aside className={`absolute right-4 top-4 bottom-4 ${panelWidthClass} bg-white/90 backdrop-blur-2xl border border-white/90 rounded-2xl shadow-2xl shadow-slate-900/15 text-slate-800 flex flex-col select-none z-20 overflow-hidden transition-all duration-200`}>
      {/* Top Header / Collapse Bar */}
      <div className="px-3 py-2 bg-white/60 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <button
          onClick={toggleRightPanel}
          title="Свернуть панель"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {activeTab === 'gcode' ? 'Редактор G-кода' : 'Инспектор и Станок'}
        </span>
      </div>

      {/* Tabs bar */}
      <div className="grid grid-cols-4 bg-slate-100/80 border-b border-slate-200/80 p-1 gap-1 text-[11px] font-semibold shrink-0">
        <button
          onClick={() => setActiveTab('properties')}
          title="Свойства объекта"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'properties'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Объект</span>
        </button>

        <button
          onClick={() => setActiveTab('machine')}
          title="Настройки станка"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'machine'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Станок</span>
        </button>

        <button
          onClick={() => setActiveTab('gcode')}
          title="Редактор G-кода"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'gcode'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>G-код</span>
        </button>

        <button
          onClick={() => setActiveTab('warnings')}
          title="Предупреждения и статус"
          className={`relative py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeTab === 'warnings'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Статус</span>

          {errorCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* Tab content area */}
      <div className="flex-1 overflow-hidden bg-slate-50/40 min-h-0 flex flex-col">
        {activeTab === 'properties' && <PropertiesPanel />}
        {activeTab === 'machine' && <MachineSettingsPanel />}
        {activeTab === 'gcode' && <GcodeEditor />}
        {activeTab === 'warnings' && <WarningsPanel />}
      </div>
    </aside>
  );
};


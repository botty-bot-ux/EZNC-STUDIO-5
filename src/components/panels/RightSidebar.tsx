import React from 'react';
import { AlertTriangle, Compass, Sliders } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PropertiesPanel } from './PropertiesPanel';
import { MachineSettingsPanel } from './MachineSettingsPanel';
import { WarningsPanel } from './WarningsPanel';

export const RightSidebar: React.FC = () => {
  const { activeTab, setActiveTab, warnings } = useProjectStore();

  const errorCount = warnings.filter((w) => w.level === 'error').length;

  return (
    <aside className="w-80 bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl shadow-sky-500/5 text-slate-800 flex flex-col h-full select-none shrink-0 overflow-hidden">
      {/* Tabs bar */}
      <div className="grid grid-cols-3 bg-slate-100/80 border-b border-slate-200/80 p-1 gap-1 text-[11px] font-semibold shrink-0">
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
          onClick={() => setActiveTab('warnings')}
          title="Предупреждения"
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
      <div className="flex-1 overflow-hidden bg-slate-50/40">
        {activeTab === 'properties' && <PropertiesPanel />}
        {activeTab === 'machine' && <MachineSettingsPanel />}
        {activeTab === 'warnings' && <WarningsPanel />}
      </div>
    </aside>
  );
};

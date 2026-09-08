import React from 'react';
import { Code, Compass, Shapes, SlidersHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { MobileSheet } from '../../types';

// Нижняя панель вкладок для телефонов: открывает шторку с нужной панелью.
// Повторный тап по активной вкладке — закрывает шторку.
const TABS: Array<{ id: Exclude<MobileSheet, 'none'>; label: string; Icon: typeof Shapes }> = [
  { id: 'figures', label: 'Фигуры', Icon: Shapes },
  { id: 'properties', label: 'Свойства', Icon: SlidersHorizontal },
  { id: 'gcode', label: 'G-код', Icon: Code },
  { id: 'machine', label: 'Станок', Icon: Compass },
];

export const MobileTabBar: React.FC = () => {
  const { mobileSheet, setMobileSheet, setActiveTab, objects, warnings } = useProjectStore(
    useShallow((s) => ({
      mobileSheet: s.mobileSheet,
      setMobileSheet: s.setMobileSheet,
      setActiveTab: s.setActiveTab,
      objects: s.objects,
      warnings: s.warnings,
    }))
  );

  const errorCount = warnings.filter((w) => w.level === 'error').length;

  const openTab = (id: Exclude<MobileSheet, 'none'>) => {
    if (mobileSheet === id) {
      setMobileSheet('none');
      return;
    }
    if (id === 'figures') {
      setMobileSheet('figures');
    } else {
      // setActiveTab заодно переключит viewMode (для G-кода) и откроет шторку
      setActiveTab(id);
    }
  };

  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-30 flex items-stretch bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = mobileSheet === id;
        return (
          <button
            key={id}
            onClick={() => openTab(id)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[12px] font-bold transition-colors ${
              active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
            {id === 'figures' && objects.length > 0 && (
              <span className="absolute top-1 right-[22%] bg-blue-600 text-white text-[11px] font-bold px-1 rounded-full min-w-[15px] text-center border border-white dark:border-slate-700">
                {objects.length}
              </span>
            )}
            {id === 'machine' && errorCount > 0 && (
              <span className="absolute top-1.5 right-[24%] w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

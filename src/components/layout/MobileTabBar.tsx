import React from 'react';
import { Code, Compass, Shapes, SlidersHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { MobileSheet } from '../../types';

const TABS: Array<{ id: Exclude<MobileSheet, 'none'>; label: string; Icon: typeof Shapes }> = [
  { id: 'figures', label: 'Объекты', Icon: Shapes },
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
      setActiveTab(id);
    }
  };

  return (
    <nav
      className="flex items-stretch bg-surface border-t border-line select-none z-30 shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = mobileSheet === id;
        return (
          <button
            key={id}
            onClick={() => openTab(id)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
              active ? 'text-fg bg-surface-subtle' : 'text-muted hover:text-fg'
            }`}
          >
            <div className="flex items-center gap-1">
              <Icon className={`w-4 h-4 ${active ? 'text-accent' : ''}`} />
              {id === 'figures' && objects.length > 0 && (
                <span className="font-mono text-[10px] text-muted">{objects.length}</span>
              )}
              {id === 'machine' && errorCount > 0 && (
                <span className="font-mono text-[10px] font-bold text-danger">!{errorCount}</span>
              )}
            </div>
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';
import { Header } from './components/layout/Header';
import { LeftToolbar } from './components/panels/LeftToolbar';
import { RightSidebar } from './components/panels/RightSidebar';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { FiguresList } from './components/panels/FiguresList';
import { PropertiesPanel } from './components/panels/PropertiesPanel';
import { MachineSettingsPanel } from './components/panels/MachineSettingsPanel';
import { GcodeEditor } from './components/editor/GcodeEditor';
import { SceneCanvas } from './components/canvas/SceneCanvas';
import { useProjectStore } from './store/useProjectStore';
import { useIsMobile } from './hooks/useIsMobile';

export default function App() {
  const isMobile = useIsMobile();
  const { mobileSheet, setMobileSheet } = useProjectStore(
    useShallow((s) => ({
      mobileSheet: s.mobileSheet,
      setMobileSheet: s.setMobileSheet,
    }))
  );
  const {
    selectedObjectId,
    selectedObjectIds,
    deleteSelectedObjects,
    undo,
    redo,
    setActiveTool,
    setSelectedObjectId,
    setSelectedObjectIds,
  } = useProjectStore(
    useShallow((s) => ({
      selectedObjectId: s.selectedObjectId,
      selectedObjectIds: s.selectedObjectIds,
      deleteSelectedObjects: s.deleteSelectedObjects,
      undo: s.undo,
      redo: s.redo,
      setActiveTool: s.setActiveTool,
      setSelectedObjectId: s.setSelectedObjectId,
      setSelectedObjectIds: s.setSelectedObjectIds,
    }))
  );

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // ESC key: blur active input and reset active tool to "select and move"
      if (e.key === 'Escape') {
        if (isInput && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setActiveTool('select');
        setSelectedObjectId(null);
        setSelectedObjectIds([]);
        return;
      }

      if (isInput) {
        return;
      }

      const key = e.key.toLowerCase();
      const code = e.code;

      const isZ = code === 'KeyZ' || key === 'z' || key === 'я';
      const isY = code === 'KeyY' || key === 'y' || key === 'н';

      if ((e.ctrlKey || e.metaKey) && isZ) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIds.length > 0 || selectedObjectId) {
          e.preventDefault();
          deleteSelectedObjects();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedObjectId,
    selectedObjectIds,
    deleteSelectedObjects,
    undo,
    redo,
    setActiveTool,
    setSelectedObjectId,
    setSelectedObjectIds,
  ]);

  const sheetTitle =
    mobileSheet === 'gcode'
      ? 'Редактор G-кода'
      : mobileSheet === 'properties'
      ? 'Свойства'
      : mobileSheet === 'machine'
      ? 'Параметры станка'
      : 'Фигуры';

  // Monaco тяжёлый: после первого открытия держим редактор G-кода смонтированным,
  // скрывая его через CSS. Иначе каждое закрытие шторки убивает редактор и рождает
  // «ERR Canceled» + повторную загрузку.
  const [gcodeSeen, setGcodeSeen] = React.useState(false);
  React.useEffect(() => {
    if (mobileSheet === 'gcode') setGcodeSeen(true);
  }, [mobileSheet]);

  // ───────────────────── Мобильная раскладка (телефон) ─────────────────────
  if (isMobile) {
    return (
      <div className="relative h-dvh w-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
        {/* Canvas fills entire viewport, extends behind the floating header */}
        <main className="absolute inset-0 bg-[#f8fafc] dark:bg-[#0f172a] overflow-hidden">
          <SceneCanvas />
        </main>

        {/* Header floats on top */}
        <Header />

        {/* Нижняя шторка с панелью (Фигуры / Свойства / G-код / Станок) */}
        <div
          className={`absolute inset-x-0 bottom-0 top-[46%] z-30 flex-col bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 rounded-t-2xl shadow-[0_-8px_30px_rgba(15,23,42,0.18)] overflow-hidden ${
            mobileSheet === 'none' ? 'hidden' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200/80 dark:border-slate-700/80 shrink-0 select-none">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {sheetTitle}
            </span>
            <button
              onClick={() => setMobileSheet('none')}
              title="Закрыть"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100 hover:bg-slate-200/60 hover:dark:bg-slate-600/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileSheet === 'figures' && <FiguresList />}
            {mobileSheet === 'properties' && <PropertiesPanel />}
            {mobileSheet === 'machine' && <MachineSettingsPanel />}
            {gcodeSeen && (
              <div className={mobileSheet === 'gcode' ? 'h-full' : 'hidden'}>
                <GcodeEditor />
              </div>
            )}
          </div>
        </div>

        {/* Mobile tab bar floats at the bottom */}
        <MobileTabBar />
      </div>
    );
  }

  // ───────────────────── Десктопная раскладка ─────────────────────
  return (
    <div className="relative h-dvh w-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      {/* Canvas fills entire viewport, extends behind the floating header */}
      <main className="absolute inset-0 bg-[#f8fafc] dark:bg-[#0f172a] overflow-hidden">
        <SceneCanvas />
      </main>

      {/* Header floats on top (h-16, transparent) */}
      <Header />

      {/* Floating Left Layers Toolbar Overlay */}
      <LeftToolbar />

      {/* Floating Right Inspector, Machine & G-code Editor Overlay */}
      <RightSidebar />
    </div>
  );
}

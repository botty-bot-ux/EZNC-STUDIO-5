import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Header } from './components/layout/Header';
import { LeftToolbar } from './components/panels/LeftToolbar';
import { RightSidebar } from './components/panels/RightSidebar';
import { SceneCanvas } from './components/canvas/SceneCanvas';
import { useProjectStore } from './store/useProjectStore';

export default function App() {
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f8fafc] text-slate-800 overflow-hidden font-sans">
      {/* Top Header */}
      <Header />

      {/* Main Workspace with Floating Overlays */}
      <div className="flex-1 relative min-h-0 overflow-hidden bg-[#f8fafc]">
        {/* Center Workspace (SceneCanvas) filling full screen edge-to-edge */}
        <main className="absolute inset-0 bg-[#f8fafc] overflow-hidden">
          <SceneCanvas />
        </main>

        {/* Floating Left Layers Toolbar Overlay */}
        <LeftToolbar />

        {/* Floating Right Inspector, Machine & G-code Editor Overlay */}
        <RightSidebar />
      </div>
    </div>
  );
}

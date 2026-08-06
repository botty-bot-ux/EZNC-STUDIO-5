import React from 'react';
import { Header } from './components/layout/Header';
import { LeftToolbar } from './components/panels/LeftToolbar';
import { RightSidebar } from './components/panels/RightSidebar';
import { SceneCanvas } from './components/canvas/SceneCanvas';
import { useProjectStore } from './store/useProjectStore';

export default function App() {
  const { selectedObjectId, deleteObject, undo, redo } = useProjectStore();

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          e.preventDefault();
          deleteObject(selectedObjectId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, deleteObject, undo, redo]);

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

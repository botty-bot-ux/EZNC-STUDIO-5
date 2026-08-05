import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { StatusBar } from './components/layout/StatusBar';
import { LeftToolbar } from './components/panels/LeftToolbar';
import { RightSidebar } from './components/panels/RightSidebar';
import { SceneCanvas } from './components/canvas/SceneCanvas';
import { GcodeEditor } from './components/editor/GcodeEditor';
import { useProjectStore } from './store/useProjectStore';
import { Point2D } from './types';

export default function App() {
  const { viewMode, selectedObjectId, deleteObject, undo, redo } = useProjectStore();
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);

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
    <div className="flex flex-col h-screen w-screen bg-gradient-to-br from-slate-100 via-sky-50/60 to-indigo-50/80 text-slate-800 overflow-hidden font-sans">
      {/* Top Header */}
      <Header />

      {/* Main Workspace Grid */}
      <div className="flex-1 flex min-h-0 relative gap-2 p-2 pt-0">
        {/* Left Toolbar */}
        <LeftToolbar />

        {/* Center Workspace (Canvas or Code Editor) */}
        <main className="flex-1 relative h-full min-w-0 bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl shadow-sky-500/5 overflow-hidden">
          {viewMode === 'gcode' ? (
            <GcodeEditor />
          ) : (
            <SceneCanvas onCursorMove={setCursorPos} />
          )}
        </main>

        {/* Right Inspector & Settings Sidebar */}
        <RightSidebar />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar cursorProgramPos={cursorPos} />
    </div>
  );
}

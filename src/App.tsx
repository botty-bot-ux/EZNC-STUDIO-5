import React, { Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { FileUp, X } from 'lucide-react';
import { Header } from './components/layout/Header';
import { ToolRail } from './components/panels/ToolRail';
import { LeftToolbar } from './components/panels/LeftToolbar';
import { RightSidebar } from './components/panels/RightSidebar';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { FiguresList } from './components/panels/FiguresList';
import { PropertiesPanel } from './components/panels/PropertiesPanel';
import { MachineSettingsPanel } from './components/panels/MachineSettingsPanel';
import { InspectorStatusBar } from './components/panels/InspectorStatusBar';
import { GcodeEditor } from './components/editor/GcodeEditor';
import { SceneCanvas } from './components/canvas/SceneCanvas';
import { ShapeActionsHost } from './components/canvas/ShapeActionsHost';
import { useProjectStore } from './store/useProjectStore';
import { useIsMobile } from './hooks/useIsMobile';
import { importProjectFile } from './lib/io/projectFiles';

const Scene3D = React.lazy(() => import('./components/canvas3d/Scene3D'));

const Scene3DFallback: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-canvas text-xs font-mono text-muted">
    Инициализация 3D-сцены…
  </div>
);

export default function App() {
  const isMobile = useIsMobile();
  const { mobileSheet, setMobileSheet, renderMode } = useProjectStore(
    useShallow((s) => ({
      mobileSheet: s.mobileSheet,
      setMobileSheet: s.setMobileSheet,
      renderMode: s.renderMode,
    }))
  );
  const {
    selectedObjectIds,
    deleteSelectedObjects,
    undo,
    redo,
    setActiveTool,
    setSelectedObjectIds,
    loadProjectNC,
    setPendingVectorImport,
    setShapeDialog,
    toast,
    showToast,
  } = useProjectStore(
    useShallow((s) => ({
      selectedObjectIds: s.selectedObjectIds,
      deleteSelectedObjects: s.deleteSelectedObjects,
      undo: s.undo,
      redo: s.redo,
      setActiveTool: s.setActiveTool,
      setSelectedObjectIds: s.setSelectedObjectIds,
      loadProjectNC: s.loadProjectNC,
      setPendingVectorImport: s.setPendingVectorImport,
      setShapeDialog: s.setShapeDialog,
      toast: s.toast,
      showToast: s.showToast,
    }))
  );

  // Drag & Drop импорт .nc / .cnc / .gcode / .tap / .txt / .json / .dxf / .svg в окно редактора
  const dragCounterRef = React.useRef(0);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    if (!hasFiles(e)) return;
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    importProjectFile(file, {
      loadProjectNC,
      openVectorImport: (pending) => {
        setPendingVectorImport(pending);
        setShapeDialog({ kind: 'import' });
      },
      onSuccess: (msg) => showToast(msg),
      onError: (msg) => showToast(msg, true),
    });
  };

  const dropOverlay = (
    <>
      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-[2px] p-6 select-none">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-surface/95 px-8 py-6 shadow-2xl text-center">
            <FileUp className="w-10 h-10 text-accent" />
            <div className="text-sm font-semibold text-fg">Отпустите файл для загрузки</div>
            <div className="text-xs font-mono text-muted">
              .json · .nc · .gcode · .dxf · .svg
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-lg border text-xs font-medium shadow-lg ${
            toast.isError
              ? 'bg-surface border-danger/40 text-danger'
              : 'bg-surface border-accent/40 text-accent'
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );

  // Глобальные горячие клавиши
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape') {
        if (isInput && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setActiveTool('select');
        setSelectedObjectIds([]);
        return;
      }

      if (isInput) return;

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
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          deleteSelectedObjects();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedObjectIds,
    deleteSelectedObjects,
    undo,
    redo,
    setActiveTool,
    setSelectedObjectIds,
  ]);

  const sheetTitle =
    mobileSheet === 'gcode'
      ? 'Управляющая программа (G-код)'
      : mobileSheet === 'properties'
      ? 'Инспектор'
      : mobileSheet === 'machine'
      ? 'Лист и станок'
      : 'Список деталей';

  const [gcodeSeen, setGcodeSeen] = React.useState(false);
  React.useEffect(() => {
    if (mobileSheet === 'gcode') setGcodeSeen(true);
  }, [mobileSheet]);

  const viewport =
    renderMode === '3d' ? (
      <Suspense fallback={<Scene3DFallback />}>
        <Scene3D />
      </Suspense>
    ) : (
      <SceneCanvas />
    );

  // ───────────────────── Мобильная раскладка ─────────────────────
  if (isMobile) {
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex flex-col h-dvh w-screen bg-canvas text-fg overflow-hidden font-sans"
      >
        <Header />

        <main className="relative flex-1 min-h-0 bg-canvas overflow-hidden">
          {viewport}

          {/* Выдвижная нижняя панель (Фигуры / Свойства / G-код / Станок) */}
          <div
            className={`absolute inset-x-0 bottom-0 top-[42%] z-30 flex-col bg-surface border-t border-line rounded-t-xl shadow-[0_-12px_32px_rgba(0,0,0,0.16)] overflow-hidden ${
              mobileSheet === 'none' ? 'hidden' : 'flex'
            }`}
          >
            <div className="flex items-center justify-between px-3.5 py-2 bg-surface-subtle border-b border-line shrink-0 select-none">
              <span className="text-xs font-semibold text-fg">{sheetTitle}</span>
              <button
                onClick={() => setMobileSheet('none')}
                title="Закрыть панель"
                className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors"
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
            {mobileSheet !== 'figures' && mobileSheet !== 'none' && <InspectorStatusBar />}
          </div>
        </main>

        <MobileTabBar />
        <ShapeActionsHost />
        {dropOverlay}
      </div>
    );
  }

  // ───────────────────── Десктопная раскладка (док-компоновка) ─────────────────────
  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-dvh w-screen bg-canvas text-fg overflow-hidden font-sans"
    >
      <Header />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ToolRail />
        <LeftToolbar />

        <main className="relative flex-1 min-w-0 min-h-0 flex flex-col bg-canvas overflow-hidden">
          {viewport}
        </main>

        <RightSidebar />
      </div>

      <ShapeActionsHost />
      {dropOverlay}
    </div>
  );
}

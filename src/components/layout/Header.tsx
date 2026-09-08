import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CircleDot,
  Download,
  FilePlus,
  FolderOpen,
  LineDotRightHorizontal,
  MousePointer,
  MoreHorizontal,
  Redo,
  Ruler,
  Save,
  Spline,
  Undo,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { saveAs } from 'file-saver';
import { ExportModal } from '../modals/ExportModal';
import { useOptimization } from '../../hooks/useOptimization';
import { useIsMobile } from '../../hooks/useIsMobile';

export const Header: React.FC = () => {
  const {
    projectName,
    setProjectName,
    newProject,
    loadProjectNC,
    exportProjectJSON,
    exportGcode,
    objects,
    undo,
    redo,
    undoCount,
    redoCount,
    warnings,
    setActiveTab,
    activeTool,
    setActiveTool,
    machine,
    updateMachine,
  } = useProjectStore(
    useShallow((s) => ({
      projectName: s.projectName,
      setProjectName: s.setProjectName,
      newProject: s.newProject,
      loadProjectNC: s.loadProjectNC,
      exportProjectJSON: s.exportProjectJSON,
      exportGcode: s.exportGcode,
      objects: s.objects,
      undo: s.undo,
      redo: s.redo,
      undoCount: s.historyUndo.length,
      redoCount: s.historyRedo.length,
      warnings: s.warnings,
      setActiveTab: s.setActiveTab,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      machine: s.machine,
      updateMachine: s.updateMachine,
    }))
  );

  const {
    optResult,
    isExportModalOpen,
    openExportModal,
    closeExportModal,
    runOptimize,
    undoOptimize,
  } = useOptimization();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasObjects = objects.length > 0;

  // Minimal typing for the native File System Access API (not in default DOM lib).
  interface WritableLike {
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }
  interface FileHandleLike {
    name: string;
    createWritable: () => Promise<WritableLike>;
  }
  type PickerWindow = Window & {
    showSaveFilePicker?: (opts: {
      suggestedName: string;
      types: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileHandleLike>;
  };

  // Writes text to disk via the native Save dialog (falls back to a download).
  // Returns the saved base file name, or null if the user cancelled.
  const writeToDisk = async (
    content: string,
    suggestedName: string,
    description: string,
    extensions: string[]
  ): Promise<string | null> => {
    const pickerWindow = window as PickerWindow;
    if (typeof pickerWindow.showSaveFilePicker === 'function') {
      try {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName,
          types: [{ description, accept: { 'text/plain': extensions } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return handle.name.replace(/\.[^/.]+$/, '');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        // Otherwise fall through to the download fallback.
      }
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, suggestedName);
    return suggestedName.replace(/\.[^/.]+$/, '');
  };

  const cleanProjectName = () => projectName.trim().replace(/\s+/g, '_') || 'cnc_project';

  // Save the editable project (full state) as a .json file for reopening in the editor.
  const handleSaveProject = async () => {
    const saved = await writeToDisk(
      exportProjectJSON(),
      `${cleanProjectName()}.json`,
      'Проект ЧПУ (*.json)',
      ['.json']
    );
    if (saved) setProjectName(saved);
  };

  // Export a clean G-code program (.nc) for the machine — no embedded project JSON.
  const handleExportGcode = async () => {
    if (!hasObjects) {
      alert('Нет объектов для экспорта.');
      return;
    }
    await writeToDisk(
      exportGcode(),
      `${cleanProjectName()}.nc`,
      'Управляющая программа ЧПУ (*.nc)',
      ['.nc', '.gcode', '.cnc', '.tap', '.txt']
    );
  };

  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = loadProjectNC(content, file.name);
        if (!ok) {
          alert('Ошибка при чтении файла. Проверьте содержимое файла.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;

  // Тип листа = выбор фрезы (один инструмент на лист).
  const HEAD_PRESET = {
    safeZ: 10,
    cutDepth: 17.5,
    spindleSpeed: 18000,
    feedCut: 2000,
    feedPlunge: 700,
    feedDrill: 700,
    toolDiameter: 3.0,
    toolName: 'Фреза 3мм',
    stockSheet: { enabled: true, preset: 'custom', widthY: 1681, widthX: 1081, color: '#22c55e' },
  };
  const RAIL_PRESET = {
    cutDepth: 33.5,
    spindleSpeed: 15000,
    feedCut: 700,
    feedPlunge: 700,
    feedDrill: 700,
    toolDiameter: 8.0,
    stockSheet: { enabled: true, preset: 'custom', widthY: 2080, widthX: 360, color: '#22c55e' },
  };
  const isRail = (machine.toolDiameter ?? 0) >= 5;
  const applySheet = (rail: boolean) => {
    updateMachine(rail ? RAIL_PRESET : HEAD_PRESET);
    setActiveTool('select');
    setActiveTab('machine');
  };

  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  // ─────────────── Мобильный компактный Header: 2 ряда ───────────────
  if (isMobile) {
    const toolBtn = (active: boolean) =>
      `p-2 rounded-lg transition-all shrink-0 ${
        active ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'text-slate-600 hover:bg-white/60'
      }`;
    const menuItems = [
      { label: 'Новый проект', Icon: FilePlus, onClick: () => newProject(), color: 'text-blue-600' },
      { label: 'Открыть (.json / .nc)', Icon: FolderOpen, onClick: () => fileInputRef.current?.click(), color: 'text-amber-600' },
      { label: 'Сохранить проект (.json)', Icon: Save, onClick: () => handleSaveProject(), color: 'text-emerald-600' },
      { label: 'Экспорт на ЧПУ', Icon: Download, onClick: () => openExportModal(), color: 'text-teal-600' },
    ];

    return (
      <header
        className="relative bg-[#f8fafc]/95 backdrop-blur text-slate-800 flex flex-col gap-1 px-2 pt-1.5 pb-1 select-none shrink-0 z-20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}
      >
        {/* Row 1: тип листа, название, меню */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="grid grid-cols-2 gap-0.5 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/90 shrink-0">
            <button
              onClick={() => applySheet(false)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                !isRail ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              Изг. Ø3
            </button>
            <button
              onClick={() => applySheet(true)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                isRail ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              Царг. Ø8
            </button>
          </div>

          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-slate-100/80 text-slate-800 text-sm font-semibold px-2 py-1 rounded-xl border border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none flex-1 min-w-0 text-center"
            placeholder="Проект"
          />

          {(errorCount > 0 || warningCount > 0) && (
            <button
              onClick={() => setActiveTab('machine')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold shrink-0 ${
                errorCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorCount > 0 ? errorCount : warningCount}
            </button>
          )}

          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="Меню проекта"
            className="p-2 rounded-xl bg-slate-100/90 border border-slate-200/90 text-slate-600 shrink-0"
          >
            {menuOpen ? <X className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
          </button>
        </div>

        {/* Row 2: инструменты черчения + undo/redo */}
        <div className="flex items-center gap-1 bg-slate-100/90 px-1 py-0.5 rounded-xl border border-slate-200/90 overflow-x-auto">
          <button onClick={() => setActiveTool('select')} title="Выбор и перемещение" className={toolBtn(activeTool === 'select')}>
            <MousePointer className="w-4 h-4" />
          </button>
          <button onClick={() => setActiveTool('line')} title="Линия / Отрезок" className={toolBtn(activeTool === 'line')}>
            <LineDotRightHorizontal className={`w-4 h-4 ${activeTool === 'line' ? 'text-white' : 'text-blue-600'}`} />
          </button>
          {isRail && (
            <button onClick={() => setActiveTool('point')} title="Отверстие / Точка" className={toolBtn(activeTool === 'point')}>
              <CircleDot className={`w-4 h-4 ${activeTool === 'point' ? 'text-white' : 'text-purple-600'}`} />
            </button>
          )}
          {!isRail && (
            <button onClick={() => setActiveTool('arc')} title="Дуга окружности" className={toolBtn(activeTool === 'arc')}>
              <Spline className={`w-4 h-4 ${activeTool === 'arc' ? 'text-white' : 'text-cyan-600'}`} />
            </button>
          )}
          <button onClick={() => setActiveTool('measure')} title="Линейка / Штангенциркуль" className={toolBtn(activeTool === 'measure')}>
            <Ruler className={`w-4 h-4 ${activeTool === 'measure' ? 'text-white' : 'text-rose-500'}`} />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />

          <button onClick={undo} disabled={undoCount === 0} title="Отменить" className="p-2 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-white transition-all shrink-0">
            <Undo className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={redoCount === 0} title="Повторить" className="p-2 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-white transition-all shrink-0">
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Выпадающее меню файловых действий */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-2 top-full mt-1 z-40 w-56 bg-white rounded-2xl border border-slate-200 shadow-2xl p-1.5 flex flex-col gap-0.5">
              {menuItems.map(({ label, Icon, onClick, color }) => (
                <button
                  key={label}
                  onClick={() => {
                    setMenuOpen(false);
                    onClick();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors text-left"
                >
                  <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleOpenFile}
          accept=".nc,.cnc,.gcode,.json,.tap,.txt"
          className="hidden"
        />

        <ExportModal
          isOpen={isExportModalOpen}
          onClose={closeExportModal}
          result={optResult}
          hasObjects={hasObjects}
          onOptimize={runOptimize}
          onExport={handleExportGcode}
          onUndoOptimize={undoOptimize}
        />
      </header>
    );
  }

  return (
    <header className="h-16 bg-gradient-to-b from-[#f8fafc] via-[#f8fafc]/95 via-70% to-transparent text-slate-800 flex items-center justify-between px-4 select-none shrink-0 z-20 gap-2">
      {/* Left section: Drawing Tools & Undo/Redo */}
      <div className="flex items-center gap-2">
        {/* Тип листа = выбор фрезы (один инструмент на лист) */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shadow-inner">
          <button
            onClick={() => applySheet(false)}
            title="Изголовье — фреза 3 мм (узор)"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              !isRail ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Изголовье Ø3
          </button>
          <button
            onClick={() => applySheet(true)}
            title="Царга боковая — фреза 8 мм"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              isRail ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Царга Ø8
          </button>
        </div>

        {/* Drawing Tools Toolbar */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shadow-inner">
          <button
            onClick={() => setActiveTool('select')}
            title="Выбор и перемещение (S)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'select'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('line')}
            title="Линия / Отрезок (L) · Shift = углы 90°/45°"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'line'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <LineDotRightHorizontal className={`w-4 h-4 ${activeTool === 'line' ? 'text-white' : 'text-blue-600'}`} />
          </button>

          {isRail && (
            <button
              onClick={() => setActiveTool('point')}
              title="Отверстие / Точка (H)"
              className={`p-2 rounded-lg transition-all ${
                activeTool === 'point'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CircleDot className={`w-4 h-4 ${activeTool === 'point' ? 'text-white' : 'text-purple-600'}`} />
            </button>
          )}

          {!isRail && (
            <button
              onClick={() => setActiveTool('arc')}
              title="Дуга окружности (A) · Shift = хорда 90°/45°"
              className={`p-2 rounded-lg transition-all ${
                activeTool === 'arc'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Spline className={`w-4 h-4 ${activeTool === 'arc' ? 'text-white' : 'text-cyan-600'}`} />
            </button>
          )}

          <button
            onClick={() => setActiveTool('measure')}
            title="Линейка / Штангенциркуль (M)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'measure'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Ruler className={`w-4 h-4 ${activeTool === 'measure' ? 'text-white' : 'text-rose-500'}`} />
          </button>
        </div>

        {/* Undo/Redo right after tools */}
        <div className="flex items-center gap-0.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shadow-inner">
          <button
            onClick={undo}
            disabled={undoCount === 0}
            title="Отменить (Ctrl+Z)"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 hover:bg-white transition-all"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoCount === 0}
            title="Повторить (Ctrl+Y)"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 hover:bg-white transition-all"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle section: Project Name */}
      <div className="flex-1 flex items-center justify-center max-w-xs md:max-w-md mx-2">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-slate-100/80 text-slate-800 text-sm font-semibold px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none w-full text-center transition-all shadow-inner"
          placeholder="Название проекта"
        />
      </div>

      {/* Right section: Action Icons & Warnings */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shadow-inner">
          <button
            onClick={newProject}
            title="Новый проект"
            className="p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-all hover:shadow-sm"
          >
            <FilePlus className="w-4 h-4 text-blue-600" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Открыть проект (.json / .nc)"
            className="p-2 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-white transition-all hover:shadow-sm"
          >
            <FolderOpen className="w-4 h-4 text-amber-600" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleOpenFile}
            accept=".json,.nc,.cnc,.gcode,.tap,.txt"
            className="hidden"
          />

          <button
            onClick={handleSaveProject}
            title="Сохранить проект (.json)"
            className="p-2 rounded-lg text-slate-700 hover:text-emerald-600 hover:bg-white transition-all hover:shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-600" />
          </button>
        </div>

        {/* Big export-to-CNC action */}
        <button
          onClick={openExportModal}
          title="Оптимизировать маршрут и выгрузить чистый G-код на станок"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-b from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:from-emerald-600 active:to-teal-700 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Экспорт на ЧПУ
        </button>

        {/* Warnings badge button */}
        {(errorCount > 0 || warningCount > 0) && (
          <button
            onClick={() => setActiveTab('machine')}
            title={errorCount > 0 ? `${errorCount} ошибок` : `${warningCount} предупреждений`}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
              errorCount > 0
                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 shadow-sm'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-bold">
              {errorCount > 0 ? errorCount : warningCount}
            </span>
          </button>
        )}
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={closeExportModal}
        result={optResult}
        hasObjects={hasObjects}
        onOptimize={runOptimize}
        onExport={handleExportGcode}
        onUndoOptimize={undoOptimize}
      />
    </header>
  );
};

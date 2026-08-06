import React, { useRef } from 'react';
import {
  AlertTriangle,
  Circle,
  CircleDot,
  Compass,
  FilePlus,
  FolderOpen,
  MousePointer,
  Redo,
  Save,
  Square,
  TrendingUp,
  Undo,
  Zap,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { saveAs } from 'file-saver';
import { OptimizationModal } from '../modals/OptimizationModal';
import { useOptimization } from '../../hooks/useOptimization';

export const Header: React.FC = () => {
  const {
    projectName,
    setProjectName,
    newProject,
    loadProjectNC,
    exportProjectNC,
    undo,
    redo,
    historyUndo,
    historyRedo,
    warnings,
    setActiveTab,
    activeTool,
    setActiveTool,
  } = useProjectStore();

  const { optResult, isOptModalOpen, handleOptimizeClick, closeOptModal } = useOptimization();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveAs = async () => {
    const ncStr = exportProjectNC();
    const cleanName = projectName.trim().replace(/\s+/g, '_') || 'cnc_project';

    // Try modern native browser File System Access API (opens standard Windows "Save As" file dialog)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${cleanName}.nc`,
          types: [
            {
              description: 'Управляющая программа ЧПУ (*.nc)',
              accept: {
                'text/plain': ['.nc', '.gcode', '.cnc', '.tap', '.txt'],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(ncStr);
        await writable.close();

        // Update project name from saved file name
        const savedName = handle.name.replace(/\.[^/.]+$/, '');
        if (savedName) {
          setProjectName(savedName);
        }
        return;
      } catch (err: any) {
        // If user clicked 'Cancel' in Windows dialog, do nothing
        if (err.name === 'AbortError') {
          return;
        }
        // Otherwise fall through to fallback
      }
    }

    // Fallback if browser does not support window.showSaveFilePicker
    const blob = new Blob([ncStr], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${cleanName}.nc`);
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
          alert('Ошибка при чтении файла .nc или .cnc. Проверьте содержимое файла.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;

  return (
    <header className="h-16 bg-gradient-to-b from-[#f8fafc] via-[#f8fafc]/95 via-70% to-transparent text-slate-800 flex items-center justify-between px-4 select-none shrink-0 z-20 gap-2">
      {/* Left section: Drawing Tools & Undo/Redo */}
      <div className="flex items-center gap-2">
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

          <button
            onClick={() => setActiveTool('line')}
            title="Линия / Отрезок (L)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'line'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <TrendingUp className={`w-4 h-4 ${activeTool === 'line' ? 'text-white' : 'text-blue-600'}`} />
          </button>

          <button
            onClick={() => setActiveTool('rectangle')}
            title="Прямоугольник (R)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'rectangle'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Square className={`w-4 h-4 ${activeTool === 'rectangle' ? 'text-white' : 'text-amber-600'}`} />
          </button>

          <button
            onClick={() => setActiveTool('circle')}
            title="Окружность (C)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'circle'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Circle className={`w-4 h-4 ${activeTool === 'circle' ? 'text-white' : 'text-emerald-600'}`} />
          </button>

          <button
            onClick={() => setActiveTool('arc')}
            title="Дуга окружности (A)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'arc'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Compass className={`w-4 h-4 ${activeTool === 'arc' ? 'text-white' : 'text-cyan-600'}`} />
          </button>
        </div>

        {/* Undo/Redo right after tools */}
        <div className="flex items-center gap-0.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shadow-inner">
          <button
            onClick={undo}
            disabled={historyUndo.length === 0}
            title="Отменить (Ctrl+Z)"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 hover:bg-white transition-all"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyRedo.length === 0}
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
            title="Открыть проект (.nc / .cnc)"
            className="p-2 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-white transition-all hover:shadow-sm"
          >
            <FolderOpen className="w-4 h-4 text-amber-600" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleOpenFile}
            accept=".nc,.cnc,.gcode,.json,.tap,.txt"
            className="hidden"
          />

          <button
            onClick={handleOptimizeClick}
            title="Оптимизация ЧПУ (минимальный холостой ход)"
            className="p-2 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-all hover:shadow-sm"
          >
            <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
          </button>

          <button
            onClick={handleSaveAs}
            title="Сохранить как (.nc)"
            className="p-2 rounded-lg text-slate-700 hover:text-emerald-600 hover:bg-white transition-all hover:shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-600" />
          
          </button>
        </div>

        {/* Warnings badge button */}
        {(errorCount > 0 || warningCount > 0) && (
          <button
            onClick={() => setActiveTab('warnings')}
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

      <OptimizationModal
        isOpen={isOptModalOpen}
        onClose={closeOptModal}
        result={optResult}
      />
    </header>
  );
};

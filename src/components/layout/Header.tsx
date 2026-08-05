import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Code,
  Download,
  Eye,
  FileCode,
  FilePlus,
  FolderOpen,
  Layout,
  Redo,
  Save,
  Sparkles,
  Undo,
  Zap,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { saveAs } from 'file-saver';
import { OptimizationModal } from '../modals/OptimizationModal';
import { OptimizationResult } from '../../lib/geometry/optimizer';

export const Header: React.FC = () => {
  const {
    projectName,
    setProjectName,
    newProject,
    loadProjectNC,
    exportProjectNC,
    generatedGcode,
    viewMode,
    setViewMode,
    undo,
    redo,
    historyUndo,
    historyRedo,
    warnings,
    setActiveTab,
    optimizeRoute,
  } = useProjectStore();

  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [isOptModalOpen, setIsOptModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOptimizeClick = () => {
    const res = optimizeRoute();
    if (res) {
      setOptResult(res);
      setIsOptModalOpen(true);
    } else {
      alert('Нет объектов для оптимизации.');
    }
  };

  const handleExportGcode = () => {
    const blob = new Blob([generatedGcode], { type: 'text/plain;charset=utf-8' });
    const cleanName = projectName.trim().replace(/\s+/g, '_') || 'cnc_program';
    saveAs(blob, `${cleanName}.nc`);
  };

  const handleSaveNC = () => {
    const ncStr = exportProjectNC();
    const blob = new Blob([ncStr], { type: 'text/plain;charset=utf-8' });
    const cleanName = projectName.trim().replace(/\s+/g, '_') || 'cnc_project';
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
    <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-white/80 text-slate-800 flex items-center justify-between px-4 select-none shrink-0 shadow-sm z-20">
      {/* Left section: Title & File operations */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/25">
            ЧПУ
          </div>
          <span className="font-bold text-sm tracking-wide text-slate-800 hidden md:inline">
            G-CODE STUDIO
          </span>
        </div>

        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-slate-100/80 text-slate-800 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none w-48 md:w-60 transition-all shadow-inner"
          placeholder="Название проекта"
        />

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200/80">
          <button
            onClick={newProject}
            title="Новый проект"
            className="p-1.5 px-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5 text-xs font-medium border border-transparent hover:border-slate-300/50"
          >
            <FilePlus className="w-4 h-4 text-blue-600" />
            <span className="hidden lg:inline">Новый</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Открыть файл .nc / .cnc"
            className="p-1.5 px-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5 text-xs font-medium border border-transparent hover:border-slate-300/50"
          >
            <FolderOpen className="w-4 h-4 text-amber-600" />
            <span className="hidden lg:inline">Открыть (.nc)</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleOpenFile}
            accept=".nc,.cnc,.gcode,.json,.tap,.txt"
            className="hidden"
          />

          <button
            onClick={handleSaveNC}
            title="Сохранить проект в формате .nc"
            className="p-1.5 px-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5 text-xs font-medium border border-transparent hover:border-slate-300/50"
          >
            <Save className="w-4 h-4 text-emerald-600" />
            <span className="hidden lg:inline">Сохранить (.nc)</span>
          </button>
        </div>
      </div>

      {/* Middle section: View Switchers & Undo/Redo */}
      <div className="flex items-center gap-3">
        {/* Undo/Redo */}
        <div className="flex items-center bg-slate-200/60 backdrop-blur-md rounded-lg p-0.5 border border-slate-300/60 shadow-inner">
          <button
            onClick={undo}
            disabled={historyUndo.length === 0}
            title="Отменить (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-700 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-700 hover:bg-white/80 transition-all"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyRedo.length === 0}
            title="Повторить (Ctrl+Y)"
            className="p-1.5 rounded-md text-slate-700 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-700 hover:bg-white/80 transition-all"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-slate-200/60 backdrop-blur-md p-1 rounded-xl border border-slate-300/60 shadow-inner">
          <button
            onClick={() => setViewMode('edit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'edit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Редактор CAD</span>
          </button>

          <button
            onClick={() => setViewMode('preview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'preview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Траектория</span>
          </button>

          <button
            onClick={() => setViewMode('gcode')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'gcode'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>G-код</span>
          </button>
        </div>
      </div>

      {/* Right section: Optimization, Warnings & Export */}
      <div className="flex items-center gap-3">
        {/* Optimize CNC Route Button */}
        <button
          onClick={handleOptimizeClick}
          title="Автоматически отсортировать близкие объекты и развернуть векторы для минимального холостого хода"
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-md shadow-orange-500/20 transition-all cursor-pointer border border-amber-300/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Zap className="w-4 h-4 fill-amber-100 text-amber-100" />
          <span>Оптимизация ЧПУ</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-100 opacity-90" />
        </button>

        {/* Warnings badge button */}
        {(errorCount > 0 || warningCount > 0) && (
          <button
            onClick={() => setActiveTab('warnings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              errorCount > 0
                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 shadow-sm'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {errorCount > 0 ? `${errorCount} ошибок` : `${warningCount} предупр.`}
            </span>
          </button>
        )}

        {/* Big Export Gcode button */}
        <button
          onClick={handleExportGcode}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
        >
          <FileCode className="w-4 h-4" />
          <span>Скачать G-code (.nc)</span>
          <Download className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      <OptimizationModal
        isOpen={isOptModalOpen}
        onClose={() => setIsOptModalOpen(false)}
        result={optResult}
      />
    </header>
  );
};

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CircleDot,
  Download,
  FilePlus,
  FileUp,
  FolderOpen,
  HelpCircle,
  Moon,
  MoreHorizontal,
  Redo,
  Save,
  Spline,
  Sun,
  Undo,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { isRailMachine, ProjectMode } from '../../store/initialState';
import {
  FILE_INPUT_ACCEPT,
  importProjectFile,
  writeTextFileToDisk,
} from '../../lib/io/projectFiles';
import { ExportModal } from '../modals/ExportModal';
import { HotkeysModal } from '../modals/HotkeysModal';
import { NewProjectModal } from '../modals/NewProjectModal';
import { useOptimization } from '../../hooks/useOptimization';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getToolDefs } from './toolDefs';

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
    openSafetyDrawer,
    activeTool,
    setActiveTool,
    machine,
    applyMachinePreset,
    theme,
    toggleTheme,
    renderMode,
    setRenderMode,
    setShapeDialog,
    setPendingVectorImport,
    setActiveTab,
    showToast,
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
      openSafetyDrawer: s.openSafetyDrawer,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      machine: s.machine,
      applyMachinePreset: s.applyMachinePreset,
      theme: s.theme,
      toggleTheme: s.toggleTheme,
      renderMode: s.renderMode,
      setRenderMode: s.setRenderMode,
      setShapeDialog: s.setShapeDialog,
      setPendingVectorImport: s.setPendingVectorImport,
      setActiveTab: s.setActiveTab,
      showToast: s.showToast,
    }))
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasObjects = objects.length > 0;

  const {
    optResult,
    isExportModalOpen,
    openExportModal,
    closeExportModal,
    runOptimize,
    undoOptimize,
  } = useOptimization(() => showToast('Нет объектов для оптимизации'));

  const cleanProjectName = () => projectName.trim().replace(/\s+/g, '_') || 'cnc_project';

  const handleSaveProject = async () => {
    const saved = await writeTextFileToDisk(
      exportProjectJSON(),
      `${cleanProjectName()}.json`,
      'Проект ЧПУ (*.json)',
      ['.json']
    );
    if (saved) {
      setProjectName(saved);
      showToast(`Проект «${saved}.json» сохранён`);
    }
  };

  const handleExportGcode = async (): Promise<boolean> => {
    if (!hasObjects) {
      showToast('Нет объектов для выгрузки управляющей программы', true);
      return false;
    }
    const saved = await writeTextFileToDisk(
      exportGcode(),
      `${cleanProjectName()}.nc`,
      'Управляющая программа ЧПУ (*.nc)',
      ['.nc', '.gcode', '.cnc', '.tap', '.txt']
    );
    if (saved !== null) {
      showToast(`Программа «${saved}.nc» выгружена`);
    }
    return saved !== null;
  };

  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    e.target.value = '';
  };

  const applyPreset = (mode: ProjectMode) => {
    applyMachinePreset(mode);
    showToast(mode === 'rail' ? 'Применён пресет «Царга · Ø8 мм»' : 'Применён пресет «Изголовье · Ø3 мм»');
  };

  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;

  const isRail = isRailMachine(machine);
  const modeLabel = isRail ? `Царга · Ø${machine.toolDiameter} мм` : `Изголовье · Ø${machine.toolDiameter} мм`;
  const tools = getToolDefs(isRail);

  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);

  const viewToggle = (
    <div className="flex items-center bg-surface-subtle p-0.5 rounded-lg border border-line shrink-0">
      {(['2d', '3d'] as const).map((m) => {
        const active = renderMode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setRenderMode(m)}
            title={m === '2d' ? '2D-черчение и редактирование' : '3D-симуляция съёма материала'}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              active ? 'bg-primary text-primary-fg shadow-2xs' : 'text-muted hover:text-fg'
            }`}
          >
            {m === '2d' ? '2D Чертёж' : '3D Симуляция'}
          </button>
        );
      })}
    </div>
  );

  // ─────────────── Мобильная шапка ───────────────
  if (isMobile) {
    const menuItems = [
      { label: 'Новый проект…', Icon: FilePlus, onClick: () => setNewProjectOpen(true) },
      { label: 'Открыть (.json / .nc / .dxf / .svg)', Icon: FolderOpen, onClick: () => fileInputRef.current?.click() },
      { label: 'Импорт DXF / SVG…', Icon: FileUp, onClick: () => setShapeDialog({ kind: 'import' }) },
      { label: 'Сохранить проект (.json)', Icon: Save, onClick: () => handleSaveProject() },
      { label: 'На станок (.nc)', Icon: Download, onClick: () => openExportModal() },
      { label: 'Режим: Изголовье (Ø3)', Icon: Spline, onClick: () => applyPreset('head') },
      { label: 'Режим: Царга (Ø8)', Icon: CircleDot, onClick: () => applyPreset('rail') },
      { label: 'Горячие клавиши', Icon: HelpCircle, onClick: () => setHotkeysOpen(true) },
    ];

    return (
      <header
        className="relative bg-surface border-b border-line text-fg flex flex-col gap-1.5 px-2.5 pt-1.5 pb-1.5 select-none z-30 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-surface-subtle text-fg text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-line focus:border-accent focus:bg-surface focus:outline-none flex-1 min-w-0"
            placeholder="Название проекта"
          />

          {(errorCount > 0 || warningCount > 0) && (
            <button
              type="button"
              onClick={openSafetyDrawer}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono font-semibold border shrink-0 ${
                errorCount > 0
                  ? 'bg-danger/10 border-danger/30 text-danger'
                  : 'bg-warning/10 border-warning/30 text-warning'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorCount > 0 ? errorCount : warningCount}</span>
            </button>
          )}

          <div className="flex items-center bg-surface-subtle p-0.5 rounded-lg border border-line shrink-0">
            {(['2d', '3d'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRenderMode(m)}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  renderMode === m ? 'bg-primary text-primary-fg' : 'text-muted'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            className="p-1.5 rounded-lg bg-surface-subtle border border-line text-muted hover:text-fg shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Меню файла"
            className="p-1.5 rounded-lg bg-surface-subtle border border-line text-muted hover:text-fg shrink-0"
          >
            {menuOpen ? <X className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
          </button>
        </div>

        {renderMode === '2d' && (
          <div className="flex items-center justify-between gap-1 bg-surface-subtle px-1 py-0.5 rounded-lg border border-line overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-0.5">
              {tools.map(({ id, Icon, shortLabel, title }) => {
                const active = activeTool === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTool(id)}
                    title={title}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
                      active
                        ? 'bg-primary text-primary-fg font-semibold'
                        : 'text-fg-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px]">{shortLabel}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-0.5 pl-1 border-l border-line shrink-0">
              <button
                type="button"
                onClick={undo}
                disabled={undoCount === 0}
                title="Отменить"
                className="p-1.5 rounded-md text-fg-secondary disabled:opacity-30 hover:bg-surface-hover transition-colors"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={redoCount === 0}
                title="Повторить"
                className="p-1.5 rounded-md text-fg-secondary disabled:opacity-30 hover:bg-surface-hover transition-colors"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-2.5 top-full mt-1 z-40 w-60 bg-surface rounded-xl border border-line shadow-lg p-1 flex flex-col gap-0.5">
              {menuItems.map(({ label, Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onClick();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-fg hover:bg-surface-hover transition-colors text-left"
                >
                  <Icon className="w-4 h-4 shrink-0 text-muted" />
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
          accept={FILE_INPUT_ACCEPT}
          className="hidden"
        />

        <NewProjectModal
          isOpen={newProjectOpen}
          onClose={() => setNewProjectOpen(false)}
          hasObjects={hasObjects}
          currentMachine={machine}
          onCreate={(mode, options) => {
            setNewProjectOpen(false);
            newProject(mode, options);
          }}
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

        <HotkeysModal isOpen={hotkeysOpen} onClose={() => setHotkeysOpen(false)} />
      </header>
    );
  }

  // ─────────────── Десктопная верхняя панель (чистые 3 зоны) ───────────────
  return (
    <header className="relative h-12 bg-surface border-b border-line text-fg flex items-center justify-between px-3.5 select-none z-30 gap-6 shrink-0">
      {/* Зона 1: проект, файловые операции и быстрый переключатель пресета */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-xs font-bold tracking-tight text-fg whitespace-nowrap">
            EZNC
          </span>
          <span className="text-line-strong">/</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            title="Название проекта (используется при сохранении .json и .nc)"
            className="w-32 lg:w-44 bg-surface-subtle hover:bg-surface-hover focus:bg-surface text-fg text-xs font-semibold px-2.5 py-1 rounded-md border border-transparent hover:border-line focus:border-accent focus:outline-none transition-colors truncate"
            placeholder="Без названия"
          />
        </div>

        <div className="h-4 w-px bg-line shrink-0" />

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            title="Новый проект (выбор пресета Изголовье / Царга)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5 text-muted shrink-0" />
            <span>Новый</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Открыть проект (.json), G-код (.nc) или вектор (.dxf, .svg)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-muted shrink-0" />
            <span>Открыть</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleOpenFile}
            accept={FILE_INPUT_ACCEPT}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleSaveProject}
            title="Сохранить рабочий проект (.json), чтобы продолжить редактирование позже"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-muted shrink-0" />
            <span>Проект</span>
          </button>
        </div>

        <div className="hidden xl:block h-4 w-px bg-line shrink-0" />

        {/* Тихий индикатор активного режима — по клику открывает настройки листа и станка */}
        <button
          type="button"
          onClick={() => setActiveTab('machine')}
          title="Открыть настройки листа ДСП и станка"
          className="hidden xl:inline-flex items-center text-[11px] font-mono tabular-nums text-muted hover:text-fg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {modeLabel}
        </button>
      </div>

      {/* Зона 2: переключение 2D / 3D + Отмена / Повтор */}
      <div className="flex items-center gap-2 shrink-0">
        {viewToggle}

        <div className="flex items-center gap-0.5 bg-surface-subtle p-0.5 rounded-lg border border-line shrink-0">
          <button
            type="button"
            onClick={undo}
            disabled={undoCount === 0}
            title={`Отменить (Ctrl+Z)${undoCount > 0 ? ` · шагов: ${undoCount}` : ''}`}
            className="p-1.5 rounded-md text-fg-secondary disabled:opacity-30 hover:text-fg hover:bg-surface-hover transition-colors shrink-0 cursor-pointer disabled:cursor-default"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={redo}
            disabled={redoCount === 0}
            title={`Повторить (Ctrl+Y)${redoCount > 0 ? ` · шагов: ${redoCount}` : ''}`}
            className="p-1.5 rounded-md text-fg-secondary disabled:opacity-30 hover:text-fg hover:bg-surface-hover transition-colors shrink-0 cursor-pointer disabled:cursor-default"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Зона 3: предупреждения безопасности, справка, тема и главный экспорт */}
      <div className="flex items-center gap-1.5 shrink-0">
        {(errorCount > 0 || warningCount > 0) && (
          <button
            type="button"
            onClick={openSafetyDrawer}
            title={
              errorCount > 0
                ? `Ошибок безопасности: ${errorCount} (открыть проверку)`
                : `Предупреждений: ${warningCount} (открыть проверку)`
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              errorCount > 0
                ? 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/15'
                : 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/15'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorCount > 0 ? `${errorCount} ош.` : `${warningCount} пред.`}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setHotkeysOpen(true)}
          title="Горячие клавиши и приёмы работы"
          className="p-1.5 rounded-lg bg-surface-subtle border border-line text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
          className="p-1.5 rounded-lg bg-surface-subtle border border-line text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={openExportModal}
          title="Выгрузить готовую управляющую программу (.nc) для запуска на станке ЧПУ"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 active:opacity-100 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>На станок (.nc)</span>
        </button>
      </div>

      <NewProjectModal
        isOpen={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        hasObjects={hasObjects}
        currentMachine={machine}
        onCreate={(mode, options) => {
          setNewProjectOpen(false);
          newProject(mode, options);
        }}
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

      <HotkeysModal isOpen={hotkeysOpen} onClose={() => setHotkeysOpen(false)} />
    </header>
  );
};

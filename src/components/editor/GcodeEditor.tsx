import React from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Download, Play, RefreshCw } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { saveAs } from 'file-saver';

export const GcodeEditor: React.FC = () => {
  const {
    manualGcode,
    updateManualGcode,
    parseManualGcode,
    regenerateGcode,
    projectName,
  } = useProjectStore();

  const handleCopy = () => {
    navigator.clipboard.writeText(manualGcode);
    alert('G-код скопирован в буфер обмена!');
  };

  const handleDownload = () => {
    const blob = new Blob([manualGcode], { type: 'text/plain;charset=utf-8' });
    const cleanName = projectName.trim().replace(/\s+/g, '_') || 'program';
    saveAs(blob, `${cleanName}.nc`);
  };

  return (
    <div className="flex flex-col h-full w-full bg-white text-slate-800 overflow-hidden">
      {/* Editor toolbar */}
      <div className="py-2 px-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 select-none shadow-sm">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 font-semibold truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">NcStudio (*.NC)</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={regenerateGcode}
            title="Пересоздать G-код из графической сцены"
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 flex items-center gap-1 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline text-[11px]">Обновить</span>
          </button>

          <button
            onClick={parseManualGcode}
            title="Распарсить и показать траекторию на холсте"
            className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px]">Траектория</span>
          </button>

          <button
            onClick={handleCopy}
            title="Скопировать G-код"
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-all shadow-sm"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownload}
            title="Скачать файл .nc"
            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Monaco text editor */}
      <div className="flex-1 min-h-0 bg-white">
        <Editor
          height="100%"
          defaultLanguage="gcode"
          language="gcode"
          theme="vs"
          value={manualGcode}
          onChange={(value) => updateManualGcode(value || '')}
          options={{
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
    </div>
  );
};

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
    <div className="flex flex-col h-full bg-white/70 backdrop-blur-xl text-slate-800 overflow-hidden">
      {/* Editor toolbar */}
      <div className="h-12 bg-slate-100/80 border-b border-slate-200/80 px-4 flex items-center justify-between shrink-0 select-none shadow-sm">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-sm" />
          <span>G-CODE EDITOR (NcStudio 5 / *.NC / *.CNC)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={regenerateGcode}
            title="Перегенерировать G-код из графической сцены"
            className="px-3 py-1.5 bg-white/80 hover:bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Пересоздать из сцены</span>
          </button>

          <button
            onClick={parseManualGcode}
            title="Распарсить измененный код и показать траекторию на холсте"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Визуализировать код</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-300 mx-1" />

          <button
            onClick={handleCopy}
            title="Скопировать весь код"
            className="p-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-all shadow-sm"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownload}
            title="Скачать файл .nc"
            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md shadow-emerald-600/25 transition-all"
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
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: true },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};

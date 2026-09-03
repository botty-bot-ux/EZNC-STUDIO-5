import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { RefreshCw } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

export const GcodeEditor: React.FC = () => {
  const manualGcode = useProjectStore((s) => s.manualGcode);
  const updateManualGcode = useProjectStore((s) => s.updateManualGcode);
  const parseManualGcode = useProjectStore((s) => s.parseManualGcode);

  const handleEditorDidMount: OnMount = (editor) => {
    editor.onDidChangeCursorPosition((e) => {
      const position = e.position;
      const model = editor.getModel();
      if (!model) return;

      const currentLine = position.lineNumber;

      let foundId: string | null = null;
      for (let l = currentLine; l >= 1; l--) {
        const lineText = model.getLineContent(l);
        const match = lineText.match(/\[ID:\s*([^\]]+)\]/i);
        if (match && match[1]) {
          foundId = match[1].trim();
          break;
        }
      }

      if (foundId) {
        const { objects, selectedObjectId, setSelectedObjectId } = useProjectStore.getState();
        const exists = objects.some((o) => o.id === foundId);
        if (exists && selectedObjectId !== foundId) {
          setSelectedObjectId(foundId);
        }
      }
    });
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
            onClick={parseManualGcode}
            title="Применить изменения G-кода и обновить объекты в графическом редакторе"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px]">Обновить графический редактор</span>
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
          onMount={handleEditorDidMount}
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

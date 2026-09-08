import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { RefreshCw } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

export const GcodeEditor: React.FC = () => {
  const manualGcode = useProjectStore((s) => s.manualGcode);
  const updateManualGcode = useProjectStore((s) => s.updateManualGcode);
  const parseManualGcode = useProjectStore((s) => s.parseManualGcode);
  const theme = useProjectStore((s) => s.theme);

  const handleEditorDidMount: OnMount = (editor) => {
    editor.onDidChangeCursorPosition((e) => {
      // Реагируем только на ОСОЗНАННОЕ перемещение курсора пользователем внутри редактора.
      // При любой правке фигуры (удаление, диаметр отверстия…) G-код перегенерируется,
      // Monaco сбрасывает курсор и тоже шлёт это событие — если его не игнорировать,
      // выделение в списке фигур само прыгает на «последнюю» фигуру программы.
      if (!editor.hasTextFocus()) return;

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
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Editor toolbar */}
      <div className="py-2 px-3 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0 select-none shadow-sm">
        <div className="flex items-center gap-1.5 text-[13px] font-mono text-slate-600 dark:text-slate-300 font-semibold truncate">
          <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
          <span className="truncate">NcStudio (*.NC)</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={parseManualGcode}
            title="Применить изменения G-кода и обновить объекты в графическом редакторе"
            className="px-3 py-1.5 bg-primary hover:opacity-90 text-primary-fg text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[13px]">Обновить графический редактор</span>
          </button>
        </div>
      </div>

      {/* Monaco text editor */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900">
        <Editor
          height="100%"
          defaultLanguage="gcode"
          language="gcode"
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          value={manualGcode}
          onChange={(value) => updateManualGcode(value || '')}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
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

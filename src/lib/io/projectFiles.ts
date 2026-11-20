import { saveAs } from 'file-saver';
import { PendingVectorImport } from '../../store/projectStore.types';

export const SUPPORTED_IMPORT_EXTENSIONS = [
  'json',
  'nc',
  'cnc',
  'gcode',
  'tap',
  'txt',
  'dxf',
  'svg',
] as const;

export const FILE_INPUT_ACCEPT = SUPPORTED_IMPORT_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function isSupportedImportFile(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return (SUPPORTED_IMPORT_EXTENSIONS as readonly string[]).includes(ext);
}

export interface ProjectFileImportCallbacks {
  loadProjectNC: (content: string, fileName?: string) => boolean;
  openVectorImport: (pending: PendingVectorImport) => void;
  onSuccess?: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Единая точка чтения и импорта файлов (.json / .nc / .gcode / .dxf / .svg)
 * для кнопки «Открыть» в шапке и Drag & Drop в окне редактора.
 */
export function importProjectFile(file: File, callbacks: ProjectFileImportCallbacks): void {
  const ext = getFileExtension(file.name);
  if (!isSupportedImportFile(file.name)) {
    callbacks.onError('Поддерживаются файлы .json, .nc, .cnc, .gcode, .tap, .txt, .dxf, .svg');
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    callbacks.onError(`Не удалось прочитать файл «${file.name}»`);
  };
  reader.onload = (ev) => {
    const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
    if (!content) {
      callbacks.onError(`Файл «${file.name}» пуст`);
      return;
    }
    if (ext === 'dxf' || ext === 'svg') {
      callbacks.openVectorImport({ fileName: file.name, content, format: ext });
      return;
    }
    const ok = callbacks.loadProjectNC(content, file.name);
    if (ok) {
      callbacks.onSuccess?.(`Загружен «${file.name}»`);
    } else {
      callbacks.onError(`Не удалось разобрать «${file.name}»`);
    }
  };
  reader.readAsText(file);
}

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

/**
 * Сохраняет текстовый файл на диск через File System Access API с запасным
 * вариантом через Blob/file-saver. Возвращает имя файла без расширения или null при отмене.
 */
export async function writeTextFileToDisk(
  content: string,
  suggestedName: string,
  description: string,
  extensions: string[]
): Promise<string | null> {
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
    }
  }
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, suggestedName);
  return suggestedName.replace(/\.[^/.]+$/, '');
}

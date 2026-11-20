import { HISTORY_LIMIT } from '../projectStoreCore';
import { HistoryState, ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез истории: откат/повтор изменений objects и machine. Снимки создаются
 * в pushHistory (core), а undo/redo перекладывают их между стеками и пересобирают
 * G-код через syncAndSave. Любой undo/redo закрывает текущую «сессию ввода».
 */
export function createHistorySlice(
  ctx: StoreCtx
): Pick<ProjectStore, 'undo' | 'redo'> {
  const { get, syncAndSave, resetHistoryCoalescing } = ctx;

  return {
    undo: () => {
      resetHistoryCoalescing(); // после undo следующая правка всегда пишет новый шаг
      const undoStack = get().historyUndo;
      if (undoStack.length === 0) return;

      const previous = undoStack[undoStack.length - 1];
      const newUndo = undoStack.slice(0, undoStack.length - 1);

      const currentSnapshot: HistoryState = {
        objects: structuredClone(get().objects),
        machine: structuredClone(get().machine),
      };

      syncAndSave({
        objects: previous.objects,
        machine: previous.machine,
        historyUndo: newUndo,
        historyRedo: [currentSnapshot, ...get().historyRedo.slice(0, HISTORY_LIMIT - 1)],
      });
    },

    redo: () => {
      resetHistoryCoalescing(); // симметрично undo: после redo — всегда новый шаг
      const redoStack = get().historyRedo;
      if (redoStack.length === 0) return;

      const next = redoStack[0];
      const newRedo = redoStack.slice(1);

      const currentSnapshot: HistoryState = {
        objects: structuredClone(get().objects),
        machine: structuredClone(get().machine),
      };

      syncAndSave({
        objects: next.objects,
        machine: next.machine,
        historyUndo: [...get().historyUndo, currentSnapshot].slice(-HISTORY_LIMIT),
        historyRedo: newRedo,
      });
    },
  };
}

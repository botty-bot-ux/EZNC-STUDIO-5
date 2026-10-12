import { CADObject, OperationItem } from '../../types';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез операций (технологических переходов): добавление/редактирование/удаление/
 * перестановка/включение. Правка глубины на уровне операции синхронизируется в
 * связанные отверстия, чтобы генератор читал актуальную глубину.
 */
export function createOperationsSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  'addOperation' | 'updateOperation' | 'deleteOperation' | 'reorderOperations' | 'toggleOperationEnabled'
> {
  const { get, pushHistory, syncAndSave } = ctx;

  return {
    addOperation: (op: OperationItem) => {
      pushHistory();
      syncAndSave({
        operations: [...get().operations, op],
        selectedOperationId: op.id,
      });
    },

    updateOperation: (id: string, partial: Partial<OperationItem>) => {
      pushHistory();
      const newOps = get().operations.map((op) => (op.id === id ? { ...op, ...partial } : op));

      // Keep hole depth in sync: the generator reads a point's own `depth` for drilling.
      // Editing depth at the operation level must flow into the linked holes.
      const merged = newOps.find((op) => op.id === id);
      let payload: Partial<ProjectStore> = { operations: newOps };
      if (merged && typeof partial.finalDepth === 'number' && merged.linkedObjectIds.length > 0) {
        const linked = new Set(merged.linkedObjectIds);
        const newObjs = get().objects.map((o) =>
          linked.has(o.id) && o.type === 'point' ? ({ ...o, depth: partial.finalDepth } as CADObject) : o
        );
        payload = { operations: newOps, objects: newObjs };
      }
      syncAndSave(payload);
    },

    deleteOperation: (id: string) => {
      pushHistory();
      const newOps = get().operations.filter((op) => op.id !== id);
      syncAndSave({
        operations: newOps,
        selectedOperationId: get().selectedOperationId === id ? null : get().selectedOperationId,
      });
    },

    reorderOperations: (newOps: OperationItem[]) => {
      pushHistory();
      syncAndSave({ operations: newOps });
    },

    toggleOperationEnabled: (id: string) => {
      pushHistory();
      const newOps = get().operations.map((op) => (op.id === id ? { ...op, enabled: !op.enabled } : op));
      syncAndSave({ operations: newOps });
    },
  };
}

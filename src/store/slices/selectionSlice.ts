import { ActiveTab } from '../../types';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез выделения и транзиентных превью (liveEdit/liveMeasure/liveMove/liveScale/
 * parallelPreview) и открытия модалок действий с фигурой. Ничего не пишет в
 * objects/историю/G-код — это только состояние взаимодействия.
 */
export function createSelectionSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  | 'setSelectedObjectId'
  | 'setSelectedObjectIds'
  | 'toggleObjectSelection'
  | 'selectAllObjects'
  | 'setSelectedOperationId'
  | 'setLiveEdit'
  | 'setLiveMeasure'
  | 'setLiveMove'
  | 'setLiveScale'
  | 'setParallelPreview'
  | 'setShapeDialog'
> {
  const { set, get } = ctx;

  return {
    setSelectedObjectId: (id: string | null) =>
      set((state) => ({
        selectedObjectIds: id ? [id] : [],
        ...(id
          ? {
              // Свернуто рукой → не раскрываем и не сбиваем вкладку;
              // из редактора G-кода всё равно выходим — выделение должно быть видно.
              ...(state.panelDismissed
                ? {}
                : { activeTab: 'properties' as ActiveTab, rightPanelOpen: true }),
              viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode,
            }
          : {}),
      })),

    setSelectedObjectIds: (ids: string[]) =>
      set((state) => ({
        selectedObjectIds: ids,
        ...(ids.length > 0
          ? {
              ...(state.panelDismissed
                ? {}
                : { activeTab: 'properties' as ActiveTab, rightPanelOpen: true }),
              viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode,
            }
          : {}),
      })),

    toggleObjectSelection: (id: string) => {
      const cur = get().selectedObjectIds;
      const exists = cur.includes(id);
      const newIds = exists ? cur.filter((i) => i !== id) : [...cur, id];
      set((state) => ({
        selectedObjectIds: newIds,
        ...(newIds.length > 0 && !state.panelDismissed
          ? { activeTab: 'properties' as ActiveTab, rightPanelOpen: true }
          : {}),
      }));
    },

    selectAllObjects: () => {
      const visibleIds = get().objects.filter((o) => o.visible !== false).map((o) => o.id);
      set({
        selectedObjectIds: visibleIds,
      });
    },

    setSelectedOperationId: (id: string | null) =>
      set({
        selectedOperationId: id,
      }),

    setLiveEdit: (v) => set({ liveEdit: v }),
    setLiveMeasure: (v) => set({ liveMeasure: v }),
    setLiveMove: (v) => set({ liveMove: v }),
    setLiveScale: (v) => set({ liveScale: v }),
    setParallelPreview: (v) => set({ parallelPreview: v }),
    setShapeDialog: (d) => set({ shapeDialog: d }),
  };
}

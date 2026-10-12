import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';

/**
 * Срез стора, который читает 2D-холст. Вынесен из SceneCanvas, чтобы тело
 * компонента не разрасталось списком полей; useShallow сохраняет прежнюю
 * семантику подписки (перерисовка только при изменении выбранных значений).
 */
export function useCanvasStore() {
  return useProjectStore(
    useShallow((s) => ({
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      setSelectedObjectId: s.setSelectedObjectId,
      setSelectedObjectIds: s.setSelectedObjectIds,
      toggleObjectSelection: s.toggleObjectSelection,
      addObject: s.addObject,
      updateObjectsBulk: s.updateObjectsBulk,
      deleteSelectedObjects: s.deleteSelectedObjects,
      copySelectedObjects: s.copySelectedObjects,
      pasteClipboard: s.pasteClipboard,
      machine: s.machine,
      toolpathSegments: s.toolpathSegments,
      viewMode: s.viewMode,
      setViewMode: s.setViewMode,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      arcMode: s.arcMode,
      setArcMode: s.setArcMode,
      lineMode: s.lineMode,
      setLineMode: s.setLineMode,
      setCanvasGrabbing: s.setCanvasGrabbing,
      snapToGrid: s.snapToGrid,
      setSnapToGrid: s.setSnapToGrid,
      gridStep: s.gridStep,
      setLiveEdit: s.setLiveEdit,
      setLiveMeasure: s.setLiveMeasure,
      liveMove: s.liveMove,
      liveScale: s.liveScale,
      parallelPreview: s.parallelPreview,
      underlay: s.underlay,
      updateUnderlay: s.updateUnderlay,
      mobileSheet: s.mobileSheet,
      theme: s.theme,
    }))
  );
}

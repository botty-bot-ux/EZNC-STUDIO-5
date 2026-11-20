import {
  ActiveTab,
  ActiveTool,
  ArcMode,
  GcodeScrollPreview,
  LineMode,
  MobileSheet,
  RenderMode,
  ViewMode,
} from '../../types';
import { DEFAULT_UNDERLAY } from '../initialState';
import { Theme, applyThemeClass, writeStoredTheme } from '../theme';
import { computeObjectBounds } from '../../lib/geometry/transform';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * UI-срез: инструменты построения, вкладки/представления, 2D/3D-режим, тема,
 * сворачивание панелей, мобильная шторка и фоновая подложка. Все правки — чистый
 * set() состояния интерфейса, без истории и автосейва.
 */
export function createUiSlice(
  ctx: StoreCtx
): Pick<
  ProjectStore,
  | 'toggleLeftPanel'
  | 'toggleRightPanel'
  | 'setSafetyDrawerOpen'
  | 'openSafetyDrawer'
  | 'setMobileSheet'
  | 'setActiveTool'
  | 'setFilletRadius'
  | 'setArcMode'
  | 'setLineMode'
  | 'setCanvasGrabbing'
  | 'setActiveTab'
  | 'setViewMode'
  | 'setRenderMode'
  | 'setSimActiveLayerId'
  | 'setGcodeScrollPreview'
  | 'focusCanvasOnBounds'
  | 'focusCanvasOnObject'
  | 'requestFitView'
  | 'setSnapToGrid'
  | 'setGridStep'
  | 'setTheme'
  | 'toggleTheme'
  | 'setUnderlayImage'
  | 'updateUnderlay'
  | 'fitUnderlayToSheet'
  | 'clearUnderlay'
  | 'showToast'
  | 'clearToast'
> {
  const { set, get } = ctx;
  let toastSeq = 0;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
    toggleRightPanel: () =>
      set((state) => {
        const next = !state.rightPanelOpen;
        // Открыл сам — снова разрешаем авто-раскрытие; свернул сам — запрещаем.
        return {
          rightPanelOpen: next,
          panelDismissed: !next,
          ...(next ? {} : { gcodeScrollPreview: null, safetyDrawerOpen: false }),
        };
      }),

    setSafetyDrawerOpen: (open: boolean) => set({ safetyDrawerOpen: open }),
    openSafetyDrawer: () =>
      set((state) => ({
        rightPanelOpen: true,
        panelDismissed: false,
        safetyDrawerOpen: true,
        mobileSheet: state.mobileSheet === 'none' ? 'machine' : state.mobileSheet,
      })),

    setMobileSheet: (sheet: MobileSheet) =>
      set({
        mobileSheet: sheet,
        ...(sheet !== 'gcode' ? { gcodeScrollPreview: null } : {}),
        ...(sheet === 'none' ? { safetyDrawerOpen: false } : {}),
      }),

    setActiveTool: (tool: ActiveTool) =>
      set((state) => ({
        activeTool: tool,
        ...(tool === 'measure'
          ? {
              ...(state.panelDismissed
                ? {}
                : { activeTab: 'properties' as ActiveTab, mobileSheet: 'properties' as MobileSheet, rightPanelOpen: true }),
              viewMode: state.viewMode === 'gcode' ? 'edit' : state.viewMode,
            }
          : {}),
      })),
    setFilletRadius: (r: number) =>
      set({ filletRadius: Number.isFinite(r) ? Math.max(0.5, Math.min(500, r)) : 10 }),
    setArcMode: (mode: ArcMode) => set({ arcMode: mode }),
    setLineMode: (mode: LineMode) => set({ lineMode: mode }),
    setCanvasGrabbing: (grabbing: boolean) => set({ canvasGrabbing: grabbing }),
    setActiveTab: (tab: ActiveTab) =>
      set((state) => ({
        activeTab: tab,
        mobileSheet: tab,
        // Явный клик по вкладке или ярлыку настроек всегда раскрывает инспектор.
        rightPanelOpen: true,
        panelDismissed: false,
        viewMode: tab === 'gcode' ? 'gcode' : state.viewMode === 'gcode' ? 'edit' : state.viewMode,
        ...(tab !== 'gcode' ? { gcodeScrollPreview: null } : {}),
      })),
    setViewMode: (mode: ViewMode) =>
      set((state) => ({
        viewMode: mode,
        panelDismissed: false,
        activeTab: mode === 'gcode' ? 'gcode' : state.activeTab === 'gcode' ? 'machine' : state.activeTab,
        rightPanelOpen: mode === 'gcode' ? true : state.rightPanelOpen,
        ...(mode !== 'gcode' ? { gcodeScrollPreview: null } : {}),
      })),
    // Переключение 2D/3D — чистый UI-переезд: не правим objects/историю/автосейв,
    // не трогаем viewMode/activeTab. 3D-сцена читает текущее состояние как потребитель.
    setRenderMode: (mode: RenderMode) => set({ renderMode: mode }),
    // Транзиентный «активный слой» симуляции — только для подсветки в списке фигур.
    setSimActiveLayerId: (id: string | null) => set({ simActiveLayerId: id }),
    setGcodeScrollPreview: (v: GcodeScrollPreview | null) => set({ gcodeScrollPreview: v }),
    focusCanvasOnBounds: (bounds) =>
      set((state) => ({
        renderMode: '2d',
        canvasFocusRequest: {
          ...bounds,
          seq: (state.canvasFocusRequest?.seq ?? 0) + 1,
        },
      })),
    focusCanvasOnObject: (id: string) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return;
      const b = computeObjectBounds(obj);
      get().focusCanvasOnBounds(b);
    },
    requestFitView: () =>
      set((state) => ({
        renderMode: '2d',
        canvasFitSeq: state.canvasFitSeq + 1,
      })),
    setSnapToGrid: (snap: boolean) => set({ snapToGrid: snap }),
    setGridStep: (step: number) => set({ gridStep: step }),

    // Тема — отдельный локальный ключ, вне истории/автосейва проекта.
    setTheme: (theme: Theme) => {
      applyThemeClass(theme);
      writeStoredTheme(theme);
      set({ theme });
    },
    toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

    // Подложка — только на сессию: plain set, без истории/автосейва/генерации G-кода.
    setUnderlayImage: (src: string) => {
      const sheet = get().machine.stockSheet;
      const widthX = sheet?.widthX ?? 1081;
      const widthY = sheet?.widthY ?? 1681;
      const cur = get().underlay;
      set({
        underlay: {
          src,
          x: -widthX,
          y: -widthY,
          w: widthX,
          h: widthY,
          opacity: cur.opacity,
          visible: true,
          frozen: false,
        },
      });
    },
    updateUnderlay: (partial) => set({ underlay: { ...get().underlay, ...partial } }),
    fitUnderlayToSheet: () => {
      const sheet = get().machine.stockSheet;
      const widthX = sheet?.widthX ?? 1081;
      const widthY = sheet?.widthY ?? 1681;
      set({
        underlay: { ...get().underlay, x: -widthX, y: -widthY, w: widthX, h: widthY },
      });
    },
    clearUnderlay: () => set({ underlay: { ...DEFAULT_UNDERLAY } }),

    showToast: (text: string, isError = false) => {
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      toastSeq += 1;
      const id = toastSeq;
      set({ toast: { id, text, isError } });
      toastTimer = setTimeout(() => {
        toastTimer = null;
        if (get().toast?.id === id) {
          set({ toast: null });
        }
      }, 3500);
    },

    clearToast: () => {
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      set({ toast: null });
    },
  };
}

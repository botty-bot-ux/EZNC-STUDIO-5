import React, { useCallback, useRef, useState } from 'react';

export type ResizablePanelMode = 'inspector' | 'gcode';

interface WidthConfig {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

const WIDTH_CONFIGS: Record<ResizablePanelMode, WidthConfig> = {
  inspector: { defaultWidth: 332, minWidth: 296, maxWidth: 480 },
  gcode: { defaultWidth: 448, minWidth: 340, maxWidth: 680 },
};

const STORAGE_KEY = 'eznc_right_panel_widths_v1';

function clampWidth(mode: ResizablePanelMode, value: number): number {
  const cfg = WIDTH_CONFIGS[mode];
  const viewportCap =
    typeof window !== 'undefined' ? Math.max(cfg.minWidth, Math.floor(window.innerWidth * 0.52)) : cfg.maxWidth;
  return Math.round(Math.max(cfg.minWidth, Math.min(cfg.maxWidth, viewportCap, value)));
}

function readStoredWidths(): Record<ResizablePanelMode, number> {
  const defaults: Record<ResizablePanelMode, number> = {
    inspector: WIDTH_CONFIGS.inspector.defaultWidth,
    gcode: WIDTH_CONFIGS.gcode.defaultWidth,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<ResizablePanelMode, number>>;
    return {
      inspector:
        typeof parsed.inspector === 'number' && Number.isFinite(parsed.inspector)
          ? clampWidth('inspector', parsed.inspector)
          : defaults.inspector,
      gcode:
        typeof parsed.gcode === 'number' && Number.isFinite(parsed.gcode)
          ? clampWidth('gcode', parsed.gcode)
          : defaults.gcode,
    };
  } catch {
    return defaults;
  }
}

function writeStoredWidths(widths: Record<ResizablePanelMode, number>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // ignore storage errors
  }
}

/**
 * Хук управления шириной правой док-панели с раздельным запоминанием
 * для режимов «Инспектор» и «G-код», плавным drag-ресайзом и сбросом по двойному клику.
 */
export function useResizablePanel(mode: ResizablePanelMode) {
  const [widths, setWidths] = useState<Record<ResizablePanelMode, number>>(readStoredWidths);
  const [resizing, setResizing] = useState(false);

  const dragRef = useRef<{ startX: number; startWidth: number; mode: ResizablePanelMode } | null>(
    null
  );
  const latestWidthsRef = useRef(widths);
  latestWidthsRef.current = widths;

  const width = clampWidth(mode, widths[mode]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startWidth: clampWidth(mode, latestWidthsRef.current[mode]),
        mode,
      };
      setResizing(true);
    },
    [mode]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Панель справа → сдвиг курсора влево увеличивает ширину
    const delta = drag.startX - e.clientX;
    const nextWidth = clampWidth(drag.mode, drag.startWidth + delta);
    setWidths((prev) => {
      if (prev[drag.mode] === nextWidth) return prev;
      return { ...prev, [drag.mode]: nextWidth };
    });
  }, []);

  const finishDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setResizing(false);
    writeStoredWidths(latestWidthsRef.current);
  }, []);

  const resetWidth = useCallback(() => {
    const next = {
      ...latestWidthsRef.current,
      [mode]: WIDTH_CONFIGS[mode].defaultWidth,
    };
    setWidths(next);
    writeStoredWidths(next);
  }, [mode]);

  return {
    width,
    resizing,
    resetWidth,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onDoubleClick: resetWidth,
    },
  };
}

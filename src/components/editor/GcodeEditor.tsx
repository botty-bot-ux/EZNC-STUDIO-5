import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { ChevronDown, ChevronUp, Crosshair, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useIsMobile } from '../../hooks/useIsMobile';
import { parseGcodeToSegments } from '../../lib/gcode/parser';
import { computeToolpathStats, formatDistanceRu, formatDurationRu } from '../../lib/gcode/stats';
import { useProjectStore } from '../../store/useProjectStore';
import { GcodeScrollPreview, ToolpathSegment } from '../../types';
import {
  buildMiniMapMeta,
  getMotionBadgeInfo,
  MiniMapData,
  segmentToSvgPath,
} from './gcodePreviewHelpers';

type MonacoEditorInstance = Parameters<OnMount>[0];
type MonacoNamespace = Parameters<OnMount>[1];
type DecorationsCollection = ReturnType<MonacoEditorInstance['createDecorationsCollection']>;

const MANUAL_PARSE_DEBOUNCE_MS = 180;

export const GcodeEditor: React.FC = () => {
  const isMobile = useIsMobile();
  const {
    manualGcode,
    updateManualGcode,
    parseManualGcode,
    theme,
    manualGcodeDirty,
    objects,
    machine,
    activeTab,
    rightPanelOpen,
    mobileSheet,
    gcodeScrollPreview,
    setGcodeScrollPreview,
    focusCanvasOnBounds,
  } = useProjectStore(
    useShallow((s) => ({
      manualGcode: s.manualGcode,
      updateManualGcode: s.updateManualGcode,
      parseManualGcode: s.parseManualGcode,
      theme: s.theme,
      manualGcodeDirty: s.manualGcodeDirty,
      objects: s.objects,
      machine: s.machine,
      activeTab: s.activeTab,
      rightPanelOpen: s.rightPanelOpen,
      mobileSheet: s.mobileSheet,
      gcodeScrollPreview: s.gcodeScrollPreview,
      setGcodeScrollPreview: s.setGcodeScrollPreview,
      focusCanvasOnBounds: s.focusCanvasOnBounds,
    }))
  );

  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);

  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<MonacoNamespace | null>(null);
  const decorationsRef = useRef<DecorationsCollection | null>(null);
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const rafRef = useRef<number | null>(null);
  const preferCursorRef = useRef(false);
  const lastKeyRef = useRef<string>('');

  const isEditorVisible = isMobile
    ? mobileSheet === 'gcode'
    : activeTab === 'gcode' && rightPanelOpen;

  // При ручном вводе в Monaco откладываем парсинг G-кода (debounce),
  // чтобы ввод не тормозил на больших программах; при программной генерации обновляем сразу.
  const [debouncedGcode, setDebouncedGcode] = useState(manualGcode);
  useEffect(() => {
    if (!manualGcodeDirty) {
      setDebouncedGcode(manualGcode);
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedGcode(manualGcode);
    }, MANUAL_PARSE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [manualGcode, manualGcodeDirty]);

  // Разбор текущего текста G-кода в сегменты с привязкой к 1-based строкам
  const parsedSegments = useMemo(() => parseGcodeToSegments(debouncedGcode), [debouncedGcode]);
  const programStats = useMemo(
    () => computeToolpathStats(parsedSegments, machine),
    [parsedSegments, machine]
  );

  // Карта имён объектов из текста G-кода и стора (для подписи в оверлее)
  const objectLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const obj of objects) {
      map.set(obj.id, obj.name);
    }
    const lines = debouncedGcode.split('\n');
    for (const raw of lines) {
      const m = raw.match(/^\s*;\s*\[ID:\s*([^\]]+)\]\s*(?:ОБЪЕКТ:\s*)?([^\n(]+)?/i);
      if (m && m[1]) {
        const id = m[1].trim();
        if (!map.has(id) && m[2]) {
          map.set(id, m[2].trim());
        }
      }
    }
    return map;
  }, [objects, debouncedGcode]);

  // Геометрические границы всей траектории для мини-радара в оверлее
  const allPathMeta = useMemo(() => buildMiniMapMeta(parsedSegments), [parsedSegments]);

  const clearPreview = useCallback(() => {
    decorationsRef.current?.clear();
    if (lastKeyRef.current !== '') {
      lastKeyRef.current = '';
      setGcodeScrollPreview(null);
    } else if (useProjectStore.getState().gcodeScrollPreview !== null) {
      setGcodeScrollPreview(null);
    }
  }, [setGcodeScrollPreview]);

  const syncScrollPreview = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || !isEditorVisible || !previewEnabled) {
      clearPreview();
      return;
    }

    const ranges = editor.getVisibleRanges();
    if (!ranges || ranges.length === 0) {
      return;
    }

    const startLine = ranges[0].startLineNumber;
    const endLine = ranges[ranges.length - 1].endLineNumber;
    if (startLine <= 0 || endLine < startLine) return;

    const visibleSegments = parsedSegments.filter(
      (seg) => seg.lineNumber !== undefined && seg.lineNumber >= startLine && seg.lineNumber <= endLine
    );

    const midLine = Math.round((startLine + endLine) / 2);
    const cursorPos = editor.getPosition();
    const targetLine =
      preferCursorRef.current &&
      cursorPos &&
      cursorPos.lineNumber >= startLine &&
      cursorPos.lineNumber <= endLine
        ? cursorPos.lineNumber
        : midLine;

    let focusSegment: ToolpathSegment | null = null;
    let bestDist = Infinity;
    for (const seg of visibleSegments) {
      const ln = seg.lineNumber ?? 0;
      const dist = Math.abs(ln - targetLine);
      if (dist < bestDist) {
        bestDist = dist;
        focusSegment = seg;
      }
    }

    const focusLine = focusSegment?.lineNumber ?? targetLine;
    const focusSegmentId = focusSegment?.id ?? null;

    // Обновляем подсветку строк внутри Monaco
    if (decorationsRef.current) {
      const model = editor.getModel();
      const maxLine = model ? model.getLineCount() : endLine;
      const bandStart = Math.max(startLine, focusLine - 3);
      const bandEnd = Math.min(endLine, maxLine, focusLine + 3);
      type DecorationItem = Parameters<DecorationsCollection['set']>[0][number];
      const decs: DecorationItem[] = [];

      if (visibleSegments.length > 0 && bandStart <= bandEnd) {
        decs.push({
          range: new monaco.Range(bandStart, 1, bandEnd, 1),
          options: {
            isWholeLine: true,
            className: 'gcode-active-band-line',
          },
        });
      }

      if (focusSegment && focusLine >= 1 && focusLine <= maxLine) {
        decs.push({
          range: new monaco.Range(focusLine, 1, focusLine, 1),
          options: {
            isWholeLine: true,
            className: 'gcode-focus-line',
            linesDecorationsClassName: 'gcode-focus-margin',
          },
        });
      }

      decorationsRef.current.set(decs);
    }

    const activeObjectId = focusSegment?.objectId ?? visibleSegments[0]?.objectId;
    const key = `${startLine}:${endLine}:${focusLine}:${focusSegmentId ?? ''}:${visibleSegments.length}:${activeObjectId ?? ''}:${parsedSegments.length}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    const preview: GcodeScrollPreview = {
      startLine,
      endLine,
      focusLine,
      segments: visibleSegments,
      focusSegmentId,
      activeObjectId,
    };
    setGcodeScrollPreview(preview);
  }, [clearPreview, isEditorVisible, parsedSegments, previewEnabled, setGcodeScrollPreview]);

  const scheduleSync = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      syncScrollPreview();
    });
  }, [syncScrollPreview]);

  // Синхронизируемся при изменении видимости вкладки/содержимого/тумблера
  useEffect(() => {
    if (!isEditorVisible || !previewEnabled) {
      clearPreview();
      return;
    }
    scheduleSync();
  }, [isEditorVisible, previewEnabled, clearPreview, scheduleSync]);

  // Сброс при размонтировании
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      for (const d of disposablesRef.current) {
        d.dispose();
      }
      disposablesRef.current = [];
      decorationsRef.current?.clear();
      useProjectStore.getState().setGcodeScrollPreview(null);
    };
  }, []);

  const syncRef = useRef(scheduleSync);
  syncRef.current = scheduleSync;

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    for (const d of disposablesRef.current) {
      d.dispose();
    }
    disposablesRef.current = [];

    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection();

    disposablesRef.current.push(
      editor.onDidLayoutChange(() => {
        syncRef.current();
      }),
      editor.onDidScrollChange((e) => {
        if (e.scrollTopChanged) {
          preferCursorRef.current = false;
        }
        syncRef.current();
      }),
      editor.onDidChangeCursorPosition((e) => {
        preferCursorRef.current = true;
        syncRef.current();

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
        const { objects: storeObjects, selectedObjectIds, setSelectedObjectId } =
          useProjectStore.getState();
        const exists = storeObjects.some((o) => o.id === foundId);
        const lastId =
          selectedObjectIds.length > 0 ? selectedObjectIds[selectedObjectIds.length - 1] : null;
        if (exists && lastId !== foundId) {
          setSelectedObjectId(foundId);
        }
        }
      })
    );

    syncRef.current();
  };

  // Данные для HUD-оверлея и мини-радара
  const focusSegment = useMemo(() => {
    if (!gcodeScrollPreview || gcodeScrollPreview.segments.length === 0) return null;
    if (gcodeScrollPreview.focusSegmentId) {
      const exact = gcodeScrollPreview.segments.find(
        (s) => s.id === gcodeScrollPreview.focusSegmentId
      );
      if (exact) return exact;
    }
    return gcodeScrollPreview.segments[gcodeScrollPreview.segments.length - 1];
  }, [gcodeScrollPreview]);

  const miniMap = useMemo<MiniMapData | null>(() => {
    if (!previewEnabled || allPathMeta.paths.length === 0) return null;
    const activeIds = new Set(gcodeScrollPreview?.segments.map((s) => s.id) ?? []);
    const activePaths = allPathMeta.paths.filter((p) => activeIds.has(p.id));
    const focusPath = focusSegment
      ? {
          d: segmentToSvgPath(focusSegment),
          type: focusSegment.type,
          endX: focusSegment.endY,
          endY: focusSegment.endX,
        }
      : null;
    return {
      viewBox: allPathMeta.viewBox,
      allPaths: allPathMeta.paths,
      activePaths,
      focusPath,
    };
  }, [previewEnabled, allPathMeta, gcodeScrollPreview, focusSegment]);

  const activeObjectName = gcodeScrollPreview?.activeObjectId
    ? objectLabels.get(gcodeScrollPreview.activeObjectId)
    : undefined;

  const focusBadge = focusSegment ? getMotionBadgeInfo(focusSegment) : null;

  return (
    <div className="flex flex-col h-full w-full bg-surface text-fg overflow-hidden">
      {/* Панель редактора */}
      <div className="py-2 px-3 bg-surface-subtle border-b border-line flex items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 text-xs font-mono text-fg-secondary font-medium truncate">
          <span className="truncate">NcStudio · .NC</span>
          {programStats.estimatedSeconds > 0 && (
            <span
              title={`Рабочий рез: ${formatDistanceRu(programStats.cutLengthMm)} · Холостой: ${formatDistanceRu(programStats.rapidLengthMm)}`}
              className="hidden sm:inline text-[11px] text-muted whitespace-nowrap"
            >
              · ~{formatDurationRu(programStats.estimatedSeconds)}
            </span>
          )}
          {manualGcodeDirty && (
            <span className="text-[11px] font-sans text-warning whitespace-nowrap">
              · изменено
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewEnabled((v) => !v)}
            title={
              previewEnabled
                ? 'Выключить визуальный превью-оверлей и подсветку на 2D-холсте'
                : 'Включить визуальный превью-оверлей и подсветку на 2D-холсте'
            }
            className={`px-2 py-1 text-xs font-medium rounded-md border flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              previewEnabled
                ? 'bg-amber-500/12 border-amber-500/35 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                : 'bg-surface border-line text-muted hover:text-fg hover:bg-surface-hover'
            }`}
          >
            {previewEnabled ? (
              <Eye className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden sm:inline">2D-связь</span>
          </button>

          <button
            type="button"
            onClick={parseManualGcode}
            title={
              manualGcodeDirty
                ? 'G-код изменён вручную — нажмите, чтобы синхронизировать 2D-чертёж'
                : 'Применить правки G-кода в 2D-редактор'
            }
            className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              manualGcodeDirty
                ? 'bg-warning text-primary-fg ring-2 ring-warning/35 hover:opacity-95'
                : 'bg-primary hover:opacity-90 text-primary-fg'
            }`}
          >
            <RefreshCw className="w-3 h-3 shrink-0" />
            <span>Применить на холст</span>
          </button>
        </div>
      </div>

      {/* Monaco + плавающий визуальный превью-оверлей */}
      <div className="relative flex-1 min-h-0 bg-surface">
        <Editor
          height="100%"
          defaultLanguage="gcode"
          language="gcode"
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          value={manualGcode}
          onChange={(value) => updateManualGcode(value || '')}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: {
              top: 8,
              bottom: previewEnabled && !overlayCollapsed ? 86 : 16,
            },
          }}
        />

        {/* Визуальный превью-оверлей связи кода с 2D-траекторией */}
        {previewEnabled ? (
          <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 flex justify-end">
            {overlayCollapsed ? (
              <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface/95 backdrop-blur-md border border-line shadow-md text-[11px] font-mono">
                <Crosshair className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-fg font-semibold">
                  Стр. {gcodeScrollPreview?.startLine ?? '—'}–{gcodeScrollPreview?.endLine ?? '—'}
                </span>
                {focusSegment && (
                  <span className="text-muted">
                    Фокус {focusSegment.lineNumber ?? gcodeScrollPreview?.focusLine}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setOverlayCollapsed(false)}
                  title="Развернуть превью траектории"
                  className="p-0.5 rounded hover:bg-surface-hover text-muted hover:text-fg cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="w-full rounded-xl bg-surface/94 backdrop-blur-md border border-line shadow-[0_8px_24px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_28px_-4px_rgba(0,0,0,0.55)] p-2 flex items-center gap-2.5 select-none">
                {/* Мини-радар всей траектории с подсветкой прокрученного окна */}
                <div className="w-[62px] h-[46px] rounded-lg bg-canvas/90 border border-line shrink-0 overflow-hidden flex items-center justify-center">
                  {miniMap ? (
                    <svg
                      viewBox={miniMap.viewBox}
                      className="w-full h-full"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {miniMap.allPaths.map((p) => (
                        <path
                          key={`bg_${p.id}`}
                          d={p.d}
                          fill="none"
                          stroke={p.type === 'rapid' ? 'rgba(239,68,68,0.22)' : 'rgba(148,163,184,0.38)'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={p.type === 'rapid' ? '2 2' : undefined}
                        />
                      ))}
                      {miniMap.activePaths.map((p) => (
                        <path
                          key={`act_${p.id}`}
                          d={p.d}
                          fill="none"
                          stroke={
                            p.type === 'rapid'
                              ? '#ef4444'
                              : p.type === 'arc_cw' || p.type === 'arc_ccw'
                              ? '#10b981'
                              : '#f59e0b'
                          }
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={p.type === 'rapid' ? '3 2' : undefined}
                        />
                      ))}
                      {miniMap.focusPath && (
                        <>
                          <path
                            d={miniMap.focusPath.d}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          <circle
                            cx={miniMap.focusPath.endX}
                            cy={miniMap.focusPath.endY}
                            r="3.2"
                            fill="#f97316"
                            stroke="#ffffff"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}
                    </svg>
                  ) : (
                    <span className="text-[10px] font-mono text-muted">нет хода</span>
                  )}
                </div>

                {/* Телеметрия активных строк и фокусного кадра */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-mono font-semibold text-fg whitespace-nowrap">
                        Стр. {gcodeScrollPreview?.startLine ?? 1}–{gcodeScrollPreview?.endLine ?? 1}
                      </span>
                      {gcodeScrollPreview && gcodeScrollPreview.segments.length > 0 && (
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          · {gcodeScrollPreview.segments.length} кадр.
                        </span>
                      )}
                      {activeObjectName && (
                        <span className="text-[11px] text-muted truncate">
                          · {activeObjectName}
                        </span>
                      )}
                    </div>

                    <div className="pointer-events-auto flex items-center gap-0.5 shrink-0">
                      {focusSegment && (
                        <button
                          type="button"
                          onClick={() =>
                            focusCanvasOnBounds({
                              minX: Math.min(focusSegment.startX, focusSegment.endX),
                              maxX: Math.max(focusSegment.startX, focusSegment.endX),
                              minY: Math.min(focusSegment.startY, focusSegment.endY),
                              maxY: Math.max(focusSegment.startY, focusSegment.endY),
                            })
                          }
                          title="Центрировать 2D-холст на фокусном кадре"
                          className="p-0.5 rounded hover:bg-surface-hover text-muted hover:text-accent cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOverlayCollapsed(true)}
                        title="Свернуть оверлей"
                        className="p-0.5 rounded hover:bg-surface-hover text-muted hover:text-fg cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {focusSegment && focusBadge ? (
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold leading-none ${focusBadge.badgeClass}`}
                      >
                        <span className="font-mono">
                          L{focusSegment.lineNumber ?? gcodeScrollPreview?.focusLine}
                        </span>
                        <span>{focusBadge.label}</span>
                      </span>

                      <span className="text-[11px] font-mono text-fg-secondary truncate">
                        X{focusSegment.endX.toFixed(1)} Y{focusSegment.endY.toFixed(1)} Z
                        {focusSegment.endZ.toFixed(1)}
                        {focusSegment.feed ? ` F${Math.round(focusSegment.feed)}` : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted truncate">
                      В видимой области нет команд перемещения
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="pointer-events-none absolute right-2.5 bottom-2.5 z-10">
            <button
              type="button"
              onClick={() => setPreviewEnabled(true)}
              title="Показать визуальный превью-оверлей и подсветку строк на 2D-холсте"
              className="pointer-events-auto px-2 py-1 rounded-md bg-surface/92 backdrop-blur-md border border-line shadow-sm text-[11px] text-muted hover:text-fg flex items-center gap-1.5 cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
              <span>2D-превью скрыто</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

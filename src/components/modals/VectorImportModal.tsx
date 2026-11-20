import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, FileUp, Layers, Upload, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import {
  ImportedVectorSummary,
  parseDXFContent,
  parseSVGContent,
  prepareVectorImportObjects,
  VectorPlacementOptions,
} from '../../lib/import/vectorImport';
import { computeObjectsBounds, roundedRectangleOutline } from '../../lib/geometry/transform';
import { parseDecimalOrNull } from '../../lib/utils/num';
import { CADObject, NewCADObjectInput, Point2D } from '../../types';

interface VectorImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VectorImportModal: React.FC<VectorImportModalProps> = ({ isOpen, onClose }) => {
  const {
    machine,
    pendingVectorImport,
    setPendingVectorImport,
    importVectorObjects,
    objects,
    theme,
  } = useProjectStore(
    useShallow((s) => ({
      machine: s.machine,
      pendingVectorImport: s.pendingVectorImport,
      setPendingVectorImport: s.setPendingVectorImport,
      importVectorObjects: s.importVectorObjects,
      objects: s.objects,
      theme: s.theme,
    }))
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [summary, setSummary] = useState<ImportedVectorSummary | null>(null);
  const [scaleStr, setScaleStr] = useState<string>('1');
  const [autoJoin, setAutoJoin] = useState<boolean>(true);
  const [placement, setPlacement] = useState<VectorPlacementOptions['placement']>('sheetCenter');
  const [marginStr, setMarginStr] = useState<string>('20');
  const [importMode, setImportMode] = useState<'append' | 'replace'>(
    objects.length > 0 ? 'append' : 'replace'
  );

  const defaultDepth = machine.cutDepth ?? 17.5;

  const parseLoaded = (name: string, content: string, fmtHint?: 'dxf' | 'svg') => {
    const ext = fmtHint ?? (name.split('.').pop()?.toLowerCase() === 'svg' ? 'svg' : 'dxf');
    const parsed =
      ext === 'svg'
        ? parseSVGContent(content, defaultDepth)
        : parseDXFContent(content, defaultDepth);
    setFileName(name);
    setSummary(parsed);
    setScaleStr(String(parsed.suggestedScale || 1));
    setAutoJoin(true);
    setPlacement(machine.stockSheet?.enabled ? 'sheetCenter' : 'sheetMargin');
  };

  useEffect(() => {
    if (!isOpen) return;
    if (pendingVectorImport) {
      parseLoaded(
        pendingVectorImport.fileName,
        pendingVectorImport.content,
        pendingVectorImport.format
      );
      setPendingVectorImport(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pendingVectorImport]);

  const handleClose = () => {
    setPendingVectorImport(null);
    onClose();
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) parseLoaded(file.name, text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const scaleVal = useMemo(() => {
    const n = parseDecimalOrNull(scaleStr);
    return n !== null && n > 0 ? n : 1;
  }, [scaleStr]);

  const marginVal = useMemo(() => {
    const n = parseDecimalOrNull(marginStr);
    return n !== null && n >= 0 ? n : 0;
  }, [marginStr]);

  const preparedObjects: NewCADObjectInput[] = useMemo(() => {
    if (!summary || summary.objects.length === 0) return [];
    return prepareVectorImportObjects(summary, {
      scale: scaleVal,
      autoJoin,
      placement,
      marginMm: marginVal,
      stockSheet: machine.stockSheet,
      defaultDepth,
    });
  }, [summary, scaleVal, autoJoin, placement, marginVal, machine.stockSheet, defaultDepth]);

  const resultBounds = useMemo(() => {
    if (preparedObjects.length === 0) return null;
    const tmp = preparedObjects.map((o, i) => ({ ...o, id: `p_${i}` }) as CADObject);
    return computeObjectsBounds(tmp);
  }, [preparedObjects]);

  // Мини-превью контуров и листа ДСП на встроенном <canvas>
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !isOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    const stock = machine.stockSheet;
    const hasStock = stock && stock.widthX > 0 && stock.widthY > 0;
    const sMinX = hasStock ? -stock.widthX : 0;
    const sMaxX = 0;
    const sMinY = hasStock ? -stock.widthY : 0;
    const sMaxY = 0;

    let minX = resultBounds ? resultBounds.minX : sMinX;
    let maxX = resultBounds ? resultBounds.maxX : sMaxX;
    let minY = resultBounds ? resultBounds.minY : sMinY;
    let maxY = resultBounds ? resultBounds.maxY : sMaxY;

    if (hasStock) {
      minX = Math.min(minX, sMinX);
      maxX = Math.max(maxX, sMaxX);
      minY = Math.min(minY, sMinY);
      maxY = Math.max(maxY, sMaxY);
    }

    const spanY = Math.max(10, maxY - minY);
    const spanX = Math.max(10, maxX - minX);
    const pad = 20;
    const scale = Math.min((W - pad * 2) / spanY, (H - pad * 2) / spanX);

    const cyWorld = (minY + maxY) / 2;
    const cxWorld = (minX + maxX) / 2;
    const toPx = (wx: number, wy: number): Point2D => ({
      x: W / 2 + (wy - cyWorld) * scale,
      y: H / 2 + (wx - cxWorld) * scale,
    });

    // Контур листа ДСП
    if (hasStock) {
      const p1 = toPx(sMinX, sMinY);
      const p2 = toPx(sMaxX, sMaxY);
      ctx.save();
      ctx.strokeStyle = stock.enabled ? '#22c55e' : 'rgba(100,116,139,0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(
        Math.min(p1.x, p2.x),
        Math.min(p1.y, p2.y),
        Math.abs(p2.x - p1.x),
        Math.abs(p2.y - p1.y)
      );
      ctx.restore();
    }

    // Ноль координат (0,0)
    const zero = toPx(0, 0);
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(zero.x - 6, zero.y);
    ctx.lineTo(zero.x + 6, zero.y);
    ctx.moveTo(zero.x, zero.y - 6);
    ctx.lineTo(zero.x, zero.y + 6);
    ctx.stroke();
    ctx.restore();

    // Импортированные контуры
    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.75;
    for (const raw of preparedObjects) {
      if (raw.type === 'line') {
        const a = toPx(raw.startX, raw.startY);
        const b = toPx(raw.endX, raw.endY);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (raw.type === 'polyline' && raw.points.length >= 2) {
        const pts = raw.points.map((pt) => toPx(pt.x, pt.y));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (raw.closed) ctx.closePath();
        ctx.stroke();
      } else if (raw.type === 'rectangle') {
        const outline = roundedRectangleOutline(raw, 6);
        const pts = outline.map((pt) => toPx(pt.x, pt.y));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.stroke();
      } else if (raw.type === 'circle') {
        const c = toPx(raw.centerX, raw.centerY);
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(1, raw.radius * scale), 0, Math.PI * 2);
        ctx.stroke();
      } else if (raw.type === 'arc') {
        const cp = toPx(raw.centerX, raw.centerY);
        const pS = toPx(raw.startX, raw.startY);
        const pE = toPx(raw.endX, raw.endY);
        const a1 = Math.atan2(pS.y - cp.y, pS.x - cp.x);
        const a2 = Math.atan2(pE.y - cp.y, pE.x - cp.x);
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, Math.max(1, raw.radius * scale), a1, a2, !raw.clockwise);
        ctx.stroke();
      }
    }
    ctx.restore();
  }, [isOpen, preparedObjects, resultBounds, machine.stockSheet, theme]);

  if (!isOpen) return null;

  const sizeY = resultBounds ? resultBounds.maxY - resultBounds.minY : 0;
  const sizeX = resultBounds ? resultBounds.maxX - resultBounds.minX : 0;

  const handleConfirm = () => {
    if (preparedObjects.length === 0) return;
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : undefined;
    importVectorObjects(preparedObjects, importMode, baseName);
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 select-none"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-label="Импорт контуров DXF / SVG"
        className="bg-surface border border-line rounded-xl max-w-2xl w-full p-5 shadow-xl text-fg max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <FileUp className="w-4 h-4 text-accent shrink-0" />
            <h3 className="font-semibold text-sm text-fg truncate">
              Импорт контуров DXF / SVG
            </h3>
            {fileName && (
              <span className="font-mono text-xs text-muted truncate">· {fileName}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Закрыть"
            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".dxf,.svg"
          onChange={handlePickFile}
          className="hidden"
        />

        {!summary ? (
          <div className="py-10 px-6 rounded-xl border-2 border-dashed border-line bg-surface-subtle/50 flex flex-col items-center justify-center gap-3 text-center">
            <Upload className="w-8 h-8 text-accent" />
            <div className="space-y-1">
              <div className="text-sm font-semibold text-fg">Выберите векторный чертёж</div>
              <p className="text-xs text-muted max-w-md">
                Поддерживаются файлы AutoCAD/CAD в формате ASCII <span className="font-mono">.dxf</span> (линии, дуги, окружности, полилинии с выпуклостью) и векторный <span className="font-mono">.svg</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 px-4 py-2 rounded-lg bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Выбрать файл (.dxf / .svg)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Левая колонка: мини-превью и сводка */}
            <div className="space-y-2.5">
              <div className="rounded-lg border border-line overflow-hidden bg-surface-subtle">
                <canvas
                  ref={previewCanvasRef}
                  width={360}
                  height={240}
                  className="w-full h-48 block"
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                <span>Зелёный пунктир — лист ДСП, крест — (0, 0)</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-accent font-medium hover:underline cursor-pointer shrink-0"
                >
                  Другой файл…
                </button>
              </div>

              {summary.warnings.length > 0 ? (
                <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{summary.warnings.join(' ')}</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-surface-subtle border border-line">
                    <span className="text-[11px] text-muted block">Фигур к импорту</span>
                    <span className="font-mono font-semibold text-fg">
                      {preparedObjects.length}{' '}
                      <span className="text-muted font-normal text-[11px]">
                        (исходно {summary.objects.length})
                      </span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-subtle border border-line">
                    <span className="text-[11px] text-muted block">Габариты (Ш × В)</span>
                    <span className="font-mono font-semibold text-fg">
                      {sizeY.toFixed(1)} × {sizeX.toFixed(1)} мм
                    </span>
                  </div>
                </div>
              )}

              {summary.detectedUnitNote && (
                <div className="text-[11px] text-muted font-mono">{summary.detectedUnitNote}</div>
              )}
            </div>

            {/* Правая колонка: настройки масштаба, стыковки и размещения */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-muted font-semibold block mb-1.5">
                  Масштаб при импорте
                </label>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '1:1', val: '1' },
                    { label: '×10 (см)', val: '10' },
                    { label: '×25.4 (дюйм)', val: '25.4' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setScaleStr(p.val)}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                        Math.abs(scaleVal - parseFloat(p.val)) < 1e-4
                          ? 'bg-primary text-primary-fg border-primary font-semibold'
                          : 'bg-surface-subtle border-line text-fg-secondary hover:text-fg'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={scaleStr}
                    onChange={(e) => setScaleStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-16 ml-auto bg-surface-subtle border border-line rounded-md px-2 py-1 text-right font-mono text-xs font-semibold text-fg focus:border-accent focus:outline-none"
                    aria-label="Коэффициент масштаба"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted font-semibold block mb-1.5">
                  Размещение на листе ДСП
                </label>
                <div className="grid grid-cols-3 gap-1 bg-surface-subtle p-0.5 rounded-lg border border-line">
                  {[
                    { id: 'sheetCenter' as const, label: 'Центр ДСП' },
                    { id: 'sheetMargin' as const, label: 'От угла (0,0)' },
                    { id: 'asIs' as const, label: 'Как в файле' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlacement(p.id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        placement === p.id
                          ? 'bg-primary text-primary-fg font-semibold'
                          : 'text-muted hover:text-fg'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {placement === 'sheetMargin' && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted">Отступ от кромки (0, 0), мм</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={marginStr}
                      onChange={(e) => setMarginStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="w-20 bg-surface-subtle border border-line rounded-md px-2 py-1 text-right font-mono text-xs font-semibold text-fg focus:border-accent focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-subtle border border-line cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoJoin}
                  onChange={(e) => setAutoJoin(e.target.checked)}
                  className="mt-0.5 accent-accent cursor-pointer"
                />
                <div>
                  <span className="font-medium text-fg block">
                    Авто-объединение отрезков в контуры
                  </span>
                  <span className="text-[11px] text-muted">
                    Сшивает стыкующиеся отрезки (допуск 0.5 мм) в единую полилинию для чистого реза.
                  </span>
                </div>
              </label>

              <div>
                <label className="text-[11px] text-muted font-semibold block mb-1.5">
                  Режим добавления
                </label>
                <div className="grid grid-cols-2 gap-1 bg-surface-subtle p-0.5 rounded-lg border border-line">
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      importMode === 'append'
                        ? 'bg-primary text-primary-fg font-semibold'
                        : 'text-muted hover:text-fg'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Добавить к проекту</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-primary text-primary-fg font-semibold'
                        : 'text-muted hover:text-fg'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Заменить чертёж</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={preparedObjects.length === 0}
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-primary-fg bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            Импортировать ({preparedObjects.length})
          </button>
        </div>
      </div>
    </div>
  );
};

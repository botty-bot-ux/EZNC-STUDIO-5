import {
  ActiveTool,
  ArcMode,
  CADObject,
  FilletPreviewState,
  LineMode,
  LineObject,
  NewCADObjectInput,
  Point2D,
  TrimPreviewState,
} from '../../types';
import { constrainAngle } from '../../lib/geometry/transform';
import { computeTrimOperation, computeTwoLineFillet } from '../../lib/geometry/cadOps';
import { findHandleHit, findObjectBodyHit } from './canvasHitTest';
import { HoveredHandle, buildArc } from './canvasUtils';
import { clampRayToPosFaces, clampToPosFaces, pointFromPolar } from './sceneCanvasGeometry';

export interface DrawingToolDownContext {
  activeTool: ActiveTool;
  snapPt: Point2D;
  shiftKey: boolean;
  zoom: number;
  objectsCount: number;
  lineMode: LineMode;
  arcMode: ArcMode;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  polyPts: Point2D[];
  measureStartPt: Point2D | null;
  measureEndPt: Point2D | null;
  lineLengthInput: string;
  lineDirAngle: number;
  addObject: (obj: NewCADObjectInput) => void;
  setDrawStartPt: (pt: Point2D | null) => void;
  setDrawArcStartPt: (pt: Point2D | null) => void;
  setDrawArcEndPt: (pt: Point2D | null) => void;
  setPolyPts: (pts: Point2D[]) => void;
  setMeasureStartPt: (pt: Point2D | null) => void;
  setMeasureEndPt: (pt: Point2D | null) => void;
  setLineLengthInput: (val: string) => void;
  setLineDirAngle: (angle: number) => void;
  finishLine: (end: Point2D) => void;
  commitPolyline: () => void;
}

/**
 * Обработка клика для инструментов построения: точка, линия/полилиния/контур,
 * прямоугольник, окружность, дуга и линейка. Возвращает true, если инструмент обработан.
 */
export function handleDrawingToolDown(ctx: DrawingToolDownContext): boolean {
  const { activeTool, snapPt, shiftKey, zoom, objectsCount, addObject } = ctx;

  if (activeTool === 'point') {
    addObject({
      name: `Отверстие ${objectsCount + 1}`,
      type: 'point',
      x: snapPt.x,
      y: snapPt.y,
      diameter: 11,
      depth: 33,
      drillMode: '11mm',
      operationType: 'drill',
    });
    return true;
  }

  if (activeTool === 'line') {
    if (ctx.lineMode !== 'line') {
      const pt = clampToPosFaces(snapPt);
      if (ctx.polyPts.length === 0) {
        ctx.setPolyPts([pt]);
      } else {
        const first = ctx.polyPts[0];
        const last = ctx.polyPts[ctx.polyPts.length - 1];
        const tol = 14 / zoom;
        const nearFirst = Math.hypot(pt.x - first.x, pt.y - first.y) <= tol;
        const nearLast = Math.hypot(pt.x - last.x, pt.y - last.y) <= tol;
        if (ctx.lineMode === 'polygon' && ctx.polyPts.length >= 2 && nearFirst) {
          ctx.commitPolyline();
        } else if (nearLast && ctx.polyPts.length >= 2) {
          ctx.commitPolyline();
        } else {
          ctx.setPolyPts([...ctx.polyPts, pt]);
        }
      }
      return true;
    }

    if (!ctx.drawStartPt) {
      ctx.setDrawStartPt(clampToPosFaces(snapPt));
      ctx.setLineLengthInput('');
      ctx.setLineDirAngle(0);
    } else {
      const L = parseFloat(ctx.lineLengthInput);
      let end: Point2D;
      if (L > 0) {
        end = pointFromPolar(ctx.drawStartPt, ctx.lineDirAngle, L);
      } else if (shiftKey) {
        end = constrainAngle(ctx.drawStartPt, snapPt, 45);
      } else {
        end = snapPt;
      }
      ctx.finishLine(end);
    }
    return true;
  }

  if (activeTool === 'rectangle') {
    if (!ctx.drawStartPt) {
      ctx.setDrawStartPt(snapPt);
    } else {
      const x = Math.min(ctx.drawStartPt.x, snapPt.x);
      const y = Math.min(ctx.drawStartPt.y, snapPt.y);
      const w = Math.abs(snapPt.x - ctx.drawStartPt.x);
      const h = Math.abs(snapPt.y - ctx.drawStartPt.y);

      if (w > 0.1 && h > 0.1) {
        addObject({
          name: `Прямоугольник ${objectsCount + 1}`,
          type: 'rectangle',
          x,
          y,
          width: w,
          height: h,
          depth: 5,
          operationType: 'cut',
        });
      }
      ctx.setDrawStartPt(null);
    }
    return true;
  }

  if (activeTool === 'circle') {
    if (!ctx.drawStartPt) {
      ctx.setDrawStartPt(snapPt);
    } else {
      const r = Math.hypot(snapPt.x - ctx.drawStartPt.x, snapPt.y - ctx.drawStartPt.y);
      if (r > 0.5) {
        addObject({
          name: `Окружность R${r.toFixed(1)} (${objectsCount + 1})`,
          type: 'circle',
          centerX: ctx.drawStartPt.x,
          centerY: ctx.drawStartPt.y,
          radius: r,
          depth: 5,
          operationType: 'cut',
        });
      }
      ctx.setDrawStartPt(null);
    }
    return true;
  }

  if (activeTool === 'arc') {
    if (!ctx.drawArcStartPt) {
      ctx.setDrawArcStartPt(clampToPosFaces(snapPt));
      ctx.setLineLengthInput('');
      ctx.setLineDirAngle(0);
    } else if (!ctx.drawArcEndPt) {
      let end: Point2D;
      const L = parseFloat(ctx.lineLengthInput);
      if (ctx.arcMode === 'center') {
        end = snapPt;
      } else if (L > 0) {
        end = pointFromPolar(ctx.drawArcStartPt, ctx.lineDirAngle, L);
      } else if (shiftKey) {
        end = constrainAngle(ctx.drawArcStartPt, snapPt, 45);
      } else {
        end = snapPt;
      }
      ctx.setDrawArcEndPt(clampRayToPosFaces(ctx.drawArcStartPt, end));
      ctx.setLineLengthInput('');
    } else {
      const arcData = buildArc(ctx.arcMode, ctx.drawArcStartPt, ctx.drawArcEndPt, snapPt);
      if (arcData) {
        addObject({
          name: `Дуга R${arcData.radius.toFixed(1)} (${objectsCount + 1})`,
          type: 'arc',
          startX: arcData.startX,
          startY: arcData.startY,
          endX: arcData.endX,
          endY: arcData.endY,
          centerX: arcData.centerX,
          centerY: arcData.centerY,
          radius: arcData.radius,
          clockwise: arcData.clockwise,
          depth: 5,
          operationType: 'cut',
        });
      }
      ctx.setDrawArcStartPt(null);
      ctx.setDrawArcEndPt(null);
    }
    return true;
  }

  if (activeTool === 'measure') {
    if (!ctx.measureStartPt || (ctx.measureStartPt && ctx.measureEndPt)) {
      ctx.setMeasureStartPt(snapPt);
      ctx.setMeasureEndPt(null);
    } else {
      ctx.setMeasureEndPt(snapPt);
    }
    return true;
  }

  return false;
}

export interface HoverEvaluationResult {
  hoveredHandle: HoveredHandle | null;
  trimPreview: TrimPreviewState | null;
  filletPreview: FilletPreviewState | null;
  statusHint?: string | null;
  clearSnap: boolean;
}

/**
 * Вычисляет подсветку/превью при наведении курсора без активного перетаскивания
 * для инструментов «Ножницы», «Скругление» и «Выбор».
 */
export function evaluateToolHover(params: {
  activeTool: ActiveTool;
  objects: CADObject[];
  selectedObjectIds: string[];
  mousePx: Point2D;
  rawWorldPt: Point2D;
  pan: Point2D;
  zoom: number;
  filletFirstPick: { id: string; clickPt: Point2D } | null;
  filletRadius: number;
}): HoverEvaluationResult | null {
  const {
    activeTool,
    objects,
    selectedObjectIds,
    mousePx,
    rawWorldPt,
    pan,
    zoom,
    filletFirstPick,
    filletRadius,
  } = params;

  if (activeTool === 'trim') {
    const hitId = findObjectBodyHit(objects, rawWorldPt, zoom);
    const hitObj = hitId ? objects.find((o) => o.id === hitId) : null;
    if (hitObj && (hitObj.type === 'line' || hitObj.type === 'arc' || hitObj.type === 'circle')) {
      const trimRes = computeTrimOperation(hitObj, rawWorldPt, objects);
      if (trimRes) {
        return {
          hoveredHandle: { objectId: hitObj.id, type: 'body' },
          trimPreview: trimRes.preview,
          filletPreview: null,
          statusHint: null,
          clearSnap: true,
        };
      }
      return {
        hoveredHandle: { objectId: hitObj.id, type: 'body' },
        trimPreview: null,
        filletPreview: null,
        statusHint: 'Фигура не пересекается с другими контурами',
        clearSnap: true,
      };
    }
    return {
      hoveredHandle: null,
      trimPreview: null,
      filletPreview: null,
      statusHint: null,
      clearSnap: true,
    };
  }

  if (activeTool === 'fillet') {
    const hitId = findObjectBodyHit(objects, rawWorldPt, zoom);
    const hitObj = hitId ? objects.find((o) => o.id === hitId) : null;
    let hoveredHandle: HoveredHandle | null = null;
    if (hitObj && (hitObj.type === 'line' || (!filletFirstPick && hitObj.type === 'rectangle'))) {
      hoveredHandle = { objectId: hitObj.id, type: 'body' };
    } else if (filletFirstPick) {
      hoveredHandle = { objectId: filletFirstPick.id, type: 'body' };
    }

    if (filletFirstPick && hitObj && hitObj.type === 'line' && hitObj.id !== filletFirstPick.id) {
      const firstLine = objects.find(
        (o): o is LineObject => o.id === filletFirstPick.id && o.type === 'line'
      );
      if (firstLine) {
        const outcome = computeTwoLineFillet(
          firstLine,
          hitObj,
          filletRadius,
          filletFirstPick.clickPt,
          rawWorldPt
        );
        if (outcome.ok) {
          return {
            hoveredHandle,
            trimPreview: null,
            filletPreview: outcome.result.preview,
            statusHint: null,
            clearSnap: true,
          };
        }
        return {
          hoveredHandle,
          trimPreview: null,
          filletPreview: null,
          statusHint: outcome.reason,
          clearSnap: true,
        };
      }
    }

    return {
      hoveredHandle,
      trimPreview: null,
      filletPreview: null,
      statusHint: !hitObj ? null : undefined,
      clearSnap: true,
    };
  }

  if (activeTool === 'select') {
    const handleHit = findHandleHit(objects, selectedObjectIds, mousePx, pan, zoom);
    if (handleHit) {
      return {
        hoveredHandle: { objectId: handleHit.objectId, type: handleHit.type },
        trimPreview: null,
        filletPreview: null,
        clearSnap: false,
      };
    }
    const bodyHitId = findObjectBodyHit(objects, rawWorldPt, zoom);
    return {
      hoveredHandle: bodyHitId ? { objectId: bodyHitId, type: 'body' } : null,
      trimPreview: null,
      filletPreview: null,
      clearSnap: false,
    };
  }

  return null;
}

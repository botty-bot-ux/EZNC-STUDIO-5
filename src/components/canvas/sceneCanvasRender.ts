import {
  ActiveTool,
  ArcMode,
  CADObject,
  LineMode,
  MachineSettings,
  ParallelPreviewState,
  Point2D,
  ToolpathSegment,
  UnderlayState,
  ViewMode,
} from '../../types';
import { DragMode } from './canvasHitTest';
import { HoveredHandle, SnapPointInfo } from './canvasUtils';
import { CanvasPalette } from './canvasPalette';
import {
  drawAxisOrigin,
  drawCADObjects,
  drawDrawingPreview,
  drawGrid,
  drawMachineBoundsAndStock,
  drawMeasurementTool,
  drawParallelPreview,
  drawSelectionBox,
  drawSnapIndicator,
  drawToolpathSegments,
  drawUnderlay,
} from './canvasDrawers';

export interface SceneRenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pan: Point2D;
  zoom: number;
  gridStep: number;
  machine: MachineSettings;
  palette: CanvasPalette;
  underlayImg: HTMLImageElement | null;
  underlay: UnderlayState;
  viewMode: ViewMode;
  toolpathSegments: ToolpathSegment[];
  displayObjects: CADObject[];
  selectedObjectIds: string[];
  hoveredHandle: HoveredHandle | null;
  dragMode: DragMode;
  parallelPreview: ParallelPreviewState | null;
  selectionBoxStart: Point2D | null;
  selectionBoxCurrent: Point2D | null;
  activeTool: ActiveTool;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  currentMouseProgPt: Point2D | null;
  arcMode: ArcMode;
  lineMode: LineMode;
  polyPts: Point2D[];
  measureStartPt: Point2D | null;
  measureEndPt: Point2D | null;
  activeSnapInfo: SnapPointInfo | null;
}

/**
 * Порядок слоёв 2D-сцены. Чистая функция отрисовки — вызывается из effect
 * перерисовки в SceneCanvas; вся геометрия вынесена в модули canvasDrawers/*.
 */
export function drawScene(p: SceneRenderParams): void {
  const { ctx, width, height, pan, zoom } = p;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // 1. Grid with Work Area Mask & Fade
  drawGrid(ctx, width, height, pan, zoom, p.gridStep, p.machine, p.palette);

  // 1b. Подложка — фоновая референсная картинка (поверх фона, под остальными слоями)
  drawUnderlay(ctx, p.underlayImg, p.underlay, pan, zoom);

  // 2. Machine Bounds & Stock
  drawMachineBoundsAndStock(ctx, p.machine, pan, zoom, p.palette);

  // 3. Axis Origin & Work Zero
  drawAxisOrigin(ctx, p.machine, pan, zoom);

  // 4. G-Code Toolpaths (in Preview or Gcode mode)
  if (p.viewMode === 'preview' || p.viewMode === 'gcode') {
    drawToolpathSegments(ctx, p.toolpathSegments, pan, zoom);
  }

  // 5. CAD Objects
  drawCADObjects(ctx, p.displayObjects, p.selectedObjectIds, p.hoveredHandle, p.dragMode, pan, zoom, p.machine.toolDiameter, p.palette);

  // 5a. Превью «Параллельная линия» (штриховые будущие копии + стрелка смещения).
  if (p.parallelPreview) {
    drawParallelPreview(ctx, p.parallelPreview, pan, zoom);
  }

  // 5b. Selection Box Marquee
  if (p.dragMode === 'selection_box' && p.selectionBoxStart && p.selectionBoxCurrent) {
    drawSelectionBox(ctx, p.selectionBoxStart, p.selectionBoxCurrent);
  }

  // 6. Active Drawing Preview
  drawDrawingPreview(
    ctx,
    p.activeTool,
    p.drawStartPt,
    p.drawArcStartPt,
    p.drawArcEndPt,
    p.currentMouseProgPt,
    pan,
    zoom,
    p.arcMode,
    p.lineMode,
    p.polyPts,
    p.machine.toolDiameter
  );

  // 6b. Measurement Tool Drawing
  if (p.activeTool === 'measure') {
    drawMeasurementTool(
      ctx,
      p.measureStartPt,
      p.measureEndPt,
      p.currentMouseProgPt,
      pan,
      zoom,
      p.palette
    );
  }

  // 7. O-SNAP Indicator
  if (p.activeSnapInfo) {
    drawSnapIndicator(ctx, p.activeSnapInfo, pan, zoom);
  }
}

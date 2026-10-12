import {
  ActiveTool,
  CADObject,
  MachineSettings,
  Point2D,
  ToolpathSegment,
  ViewMode,
} from '../../types';
import { DragMode } from './canvasHitTest';
import { HoveredHandle, SnapPointInfo } from './canvasUtils';

export interface DrawOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pan: Point2D;
  zoom: number;
  gridStep: number;
  machine: MachineSettings;
  objects: CADObject[];
  selectedObjectId: string | null;
  toolpathSegments: ToolpathSegment[];
  viewMode: ViewMode;
  activeTool: ActiveTool;
  drawStartPt: Point2D | null;
  drawArcStartPt: Point2D | null;
  drawArcEndPt: Point2D | null;
  currentMouseProgPt: Point2D | null;
  dragMode: DragMode;
  hoveredHandle: HoveredHandle | null;
  activeSnapInfo: SnapPointInfo | null;
}

export interface CanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

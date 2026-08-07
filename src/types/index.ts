export type UnitSystem = 'mm' | 'inch';

export type ControllerProfile = 'ncstudio' | 'mach3' | 'linuxcnc' | 'custom';

export type ShapeType = 'point' | 'line' | 'polyline' | 'rectangle' | 'circle' | 'arc';

export type OperationType = 'drill' | 'cut' | 'mill_circle' | 'mill_hole' | 'none';

export type DrillMode = '11mm' | '9mm' | '3mm' | '11мм' | '9мм' | '3мм';

export interface Point2D {
  x: number;
  y: number;
}

export interface BaseShape {
  id: string;
  name: string;
  type: ShapeType;
  color?: string;
  depth: number; // Positive number representing cutting depth in mm (e.g. 5 means Z = -5)
  operationType: OperationType;
  visible?: boolean; // Visibility flag for canvas and G-code generation
}

export interface PointHoleObject extends BaseShape {
  type: 'point';
  x: number;
  y: number;
  diameter: number;
  drillMode: DrillMode;
  peckDepth?: number; // for G83 peck drilling
}

export interface LineObject extends BaseShape {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface PolylineObject extends BaseShape {
  type: 'polyline';
  points: Point2D[];
  closed: boolean;
}

export interface RectangleObject extends BaseShape {
  type: 'rectangle';
  x: number; // top-right or corner x
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface CircleObject extends BaseShape {
  type: 'circle';
  centerX: number;
  centerY: number;
  radius: number;
}

export interface ArcObject extends BaseShape {
  type: 'arc';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  centerX: number;
  centerY: number;
  radius: number;
  clockwise: boolean;
}

export type CADObject =
  | PointHoleObject
  | LineObject
  | PolylineObject
  | RectangleObject
  | CircleObject
  | ArcObject;

export type NewCADObjectInput =
  | (Omit<PointHoleObject, 'id'> & { id?: string })
  | (Omit<LineObject, 'id'> & { id?: string })
  | (Omit<PolylineObject, 'id'> & { id?: string })
  | (Omit<RectangleObject, 'id'> & { id?: string })
  | (Omit<CircleObject, 'id'> & { id?: string })
  | (Omit<ArcObject, 'id'> & { id?: string });

export interface StockSheetSettings {
  enabled: boolean;
  preset: string; // 'none' | '1000x1000' | '1500x1500' | '2000x1000' | '2440x1220' | '2500x1250' | '2800x2070' | '3000x1500' | 'custom'
  widthX: number; // mm along X
  widthY: number; // mm along Y
  color?: string; // hex color for dashed line outline
}

export interface MachineSettings {
  units: UnitSystem;
  controllerProfile: ControllerProfile;
  bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  stockSheet?: StockSheetSettings;
  workOffset: {
    x: number;
    y: number;
  };
  safeZ: number;
  cutDepth?: number;
  clearanceZ?: number;
  spindleSpeed: number;
  spindleDwell: number; // milliseconds
  feedCut: number; // mm/min
  feedPlunge: number; // mm/min
  feedDrill: number; // mm/min
  toolDiameter: number;
  toolName: string;
  useCannedCycles: boolean;
}

export interface OperationItem {
  id: string;
  name: string;
  enabled: boolean;
  type: 'drill' | 'cutLine' | 'cutContour' | 'millCircle' | 'drillGroup';
  linkedObjectIds: string[];
  safeZ: number;
  startZ: number;
  finalDepth: number;
  passDepth: number; // Step down depth per pass
  spindleSpeed: number;
  feedCut: number;
  feedPlunge: number;
  feedDrill: number;
  direction: 'cw' | 'ccw';
  comment?: string;
}

export interface PostprocessorTemplates {
  header: string;
  footer: string;
  toolChange: string;
  spindleStart: string;
  spindleStop: string;
}

export interface WarningItem {
  id: string;
  level: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  objectId?: string;
}

export type ActiveTool = 'select' | 'point' | 'line' | 'polyline' | 'rectangle' | 'circle' | 'arc';
export type ActiveTab = 'properties' | 'machine' | 'gcode' | 'warnings';
export type ViewMode = 'edit' | 'preview' | 'gcode';

export interface ToolpathSegment {
  id: string;
  type: 'rapid' | 'feed' | 'arc_cw' | 'arc_ccw' | 'drill';
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
  feed?: number;
  operationId?: string;
  objectId?: string;
}

export interface ProjectData {
  version: string;
  name: string;
  machine: MachineSettings;
  objects: CADObject[];
  operations: OperationItem[];
  postprocessorTemplates: PostprocessorTemplates;
}

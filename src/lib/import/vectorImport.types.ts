import {
  CADObject,
  NewCADObjectInput,
  StockSheetSettings,
} from '../../types';
import { computeObjectsBounds } from '../geometry/transform';

export interface VectorImportCounts {
  lines: number;
  polylines: number;
  rectangles: number;
  arcs: number;
  circles: number;
}

export interface ImportedVectorSummary {
  objects: NewCADObjectInput[];
  rawBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  counts: VectorImportCounts;
  warnings: string[];
  sourceFormat: 'dxf' | 'svg';
  detectedUnitNote?: string;
  suggestedScale: number;
}

export interface VectorPlacementOptions {
  scale: number;
  autoJoin: boolean;
  placement: 'sheetCenter' | 'sheetMargin' | 'asIs';
  marginMm: number;
  stockSheet?: StockSheetSettings;
  defaultDepth: number;
}

export function summarizeObjects(objs: NewCADObjectInput[]): {
  counts: VectorImportCounts;
  rawBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
} {
  const counts: VectorImportCounts = {
    lines: 0,
    polylines: 0,
    rectangles: 0,
    arcs: 0,
    circles: 0,
  };
  const temp = objs.map((o, i) => ({ ...o, id: `tmp_${i}` }) as CADObject);
  for (const o of temp) {
    if (o.type === 'line') counts.lines++;
    else if (o.type === 'polyline') counts.polylines++;
    else if (o.type === 'rectangle') counts.rectangles++;
    else if (o.type === 'arc') counts.arcs++;
    else if (o.type === 'circle') counts.circles++;
  }
  const rawBounds = computeObjectsBounds(temp);
  return { counts, rawBounds };
}

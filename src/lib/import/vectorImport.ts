import { CADObject, NewCADObjectInput } from '../../types';
import { computeObjectsBounds, scaleCADObject, translateCADObject } from '../geometry/transform';
import { joinSelectedContours } from '../geometry/cadOps';
import type { ImportedVectorSummary, VectorPlacementOptions } from './vectorImport.types';

export type {
  VectorImportCounts,
  ImportedVectorSummary,
  VectorPlacementOptions,
} from './vectorImport.types';
export { parseDXFContent } from './dxfParser';
export { parseSVGContent } from './svgParser';

// ---------------------------------------------------------------------------
// Подготовка импортируемых фигур (масштаб, Join, размещение на листе ДСП)
// ---------------------------------------------------------------------------

export function prepareVectorImportObjects(
  summary: ImportedVectorSummary,
  opts: VectorPlacementOptions
): NewCADObjectInput[] {
  if (summary.objects.length === 0) return [];

  let working: CADObject[] = summary.objects.map((o, idx) => ({
    ...structuredClone(o),
    depth: opts.defaultDepth,
    id: `imp_${idx}`,
  })) as CADObject[];

  if (Math.abs(opts.scale - 1) > 1e-6 && opts.scale > 0) {
    const b0 = computeObjectsBounds(working);
    const anchor = b0
      ? { x: (b0.minX + b0.maxX) / 2, y: (b0.minY + b0.maxY) / 2 }
      : { x: 0, y: 0 };
    working = working.map((o) => scaleCADObject(o, anchor, opts.scale, opts.scale));
  }

  if (opts.autoJoin && working.length >= 2) {
    const res = joinSelectedContours(working, 0.5);
    if (res.consumedIds.length > 0) {
      const consumed = new Set(res.consumedIds);
      const remaining = working.filter((o) => !consumed.has(o.id));
      const created = res.joinedPolylines.map((p, i) => ({
        ...p,
        id: `joined_${i}`,
      })) as CADObject[];
      working = [...remaining, ...created];
    }
  }

  const b = computeObjectsBounds(working);
  if (b && opts.placement !== 'asIs') {
    const stockW = opts.stockSheet?.widthX ?? 1081;
    const stockH = opts.stockSheet?.widthY ?? 1681;
    let dx = 0;
    let dy = 0;

    if (opts.placement === 'sheetCenter') {
      dx = -stockW / 2 - (b.minX + b.maxX) / 2;
      dy = -stockH / 2 - (b.minY + b.maxY) / 2;
    } else if (opts.placement === 'sheetMargin') {
      // Отступ от правого-нижнего нуля (0,0) внутрь заготовки (в -X и -Y)
      dx = -opts.marginMm - b.maxX;
      dy = -opts.marginMm - b.maxY;
    }

    if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) {
      working = working.map((o) => translateCADObject(o, dx, dy));
    }
  }

  return working.map((o) => {
    const copy = { ...o } as Partial<CADObject>;
    delete copy.id;
    return copy as NewCADObjectInput;
  });
}

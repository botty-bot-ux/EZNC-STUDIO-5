import {
  CADObject,
  NewCADObjectInput,
  Point2D,
  PolylineObject,
  StockAlignMode,
  StockSheetSettings,
} from '../../types';
import { computeObjectsBounds, translateCADObject } from './transform';

// ---------------------------------------------------------------------------
// Объединение отрезков и полилиний в единый контур (Join)
// ---------------------------------------------------------------------------

export interface JoinContoursResult {
  joinedPolylines: NewCADObjectInput[];
  consumedIds: string[];
  joinedSourceCount: number;
}

/**
 * Стыкует соприкасающиеся отрезки и открытые полилинии (с допуском toleranceMm)
 * в единые полилинии/замкнутые контуры. Одиночные нестыкованные элементы остаются
 * как были и не трогаются.
 */
export function joinSelectedContours(
  selectedObjects: CADObject[],
  toleranceMm: number = 0.5
): JoinContoursResult {
  interface Chain {
    sourceIds: string[];
    points: Point2D[];
    depth: number;
    operationType: CADObject['operationType'];
    color?: string;
    visible?: boolean;
  }

  const eligible = selectedObjects.filter(
    (o) =>
      o.frozen !== true &&
      (o.type === 'line' || (o.type === 'polyline' && !o.closed && o.points.length >= 2))
  );

  if (eligible.length < 2) {
    return { joinedPolylines: [], consumedIds: [], joinedSourceCount: 0 };
  }

  const chains: Chain[] = eligible.map((o) => {
    if (o.type === 'line') {
      return {
        sourceIds: [o.id],
        points: [
          { x: o.startX, y: o.startY },
          { x: o.endX, y: o.endY },
        ],
        depth: o.depth,
        operationType: o.operationType,
        color: o.color,
        visible: o.visible,
      };
    }
    const poly = o as PolylineObject;
    return {
      sourceIds: [poly.id],
      points: poly.points.map((p) => ({ x: p.x, y: p.y })),
      depth: poly.depth,
      operationType: poly.operationType,
      color: poly.color,
      visible: poly.visible,
    };
  });

  const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < chains.length; i++) {
      for (let j = i + 1; j < chains.length; j++) {
        const A = chains[i];
        const B = chains[j];
        const aS = A.points[0];
        const aE = A.points[A.points.length - 1];
        const bS = B.points[0];
        const bE = B.points[B.points.length - 1];

        let newPoints: Point2D[] | null = null;
        if (dist(aE, bS) <= toleranceMm) {
          newPoints = [...A.points, ...B.points.slice(1)];
        } else if (dist(aE, bE) <= toleranceMm) {
          newPoints = [...A.points, ...[...B.points].reverse().slice(1)];
        } else if (dist(aS, bE) <= toleranceMm) {
          newPoints = [...B.points, ...A.points.slice(1)];
        } else if (dist(aS, bS) <= toleranceMm) {
          newPoints = [...[...B.points].reverse(), ...A.points.slice(1)];
        }

        if (newPoints) {
          chains[i] = {
            ...A,
            sourceIds: [...A.sourceIds, ...B.sourceIds],
            points: newPoints,
          };
          chains.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  const joinedPolylines: NewCADObjectInput[] = [];
  const consumedIds: string[] = [];

  chains.forEach((chain, idx) => {
    if (chain.sourceIds.length < 2) return;
    consumedIds.push(...chain.sourceIds);
    const pts = [...chain.points];
    let closed = false;
    if (pts.length >= 3 && dist(pts[0], pts[pts.length - 1]) <= toleranceMm) {
      closed = true;
      pts.pop();
    }
    joinedPolylines.push({
      name: `${closed ? 'Контур' : 'Полилиния'} (объед. ${idx + 1})`,
      type: 'polyline',
      points: pts,
      closed,
      depth: chain.depth,
      operationType: chain.operationType,
      color: chain.color,
      visible: chain.visible,
    });
  });

  return {
    joinedPolylines,
    consumedIds,
    joinedSourceCount: consumedIds.length,
  };
}

// ---------------------------------------------------------------------------
// Выравнивание фигур относительно листа ДСП
// ---------------------------------------------------------------------------

/**
 * Рассчитывает смещение (dx, dy) для выравнивания выделенных фигур как единого блока
 * относительно заготовки листа ДСП [-widthX..0] × [-widthY..0] с учётом экранных осей.
 */
export function computeStockAlignmentDelta(
  objs: CADObject[],
  stock: StockSheetSettings | undefined,
  mode: StockAlignMode,
  marginMm: number = 0
): { dx: number; dy: number } | null {
  if (!stock || stock.widthX <= 0 || stock.widthY <= 0) return null;
  const movable = objs.filter((o) => o.frozen !== true);
  const bounds = computeObjectsBounds(movable);
  if (!bounds) return null;

  // Лист ДСП в мировых координатах: X ∈ [-widthX .. 0] (верх..низ на экране),
  // Y ∈ [-widthY .. 0] (лево..право на экране).
  const stockMinX = -stock.widthX;
  const stockMaxX = 0;
  const stockMinY = -stock.widthY;
  const stockMaxY = 0;

  let dx = 0;
  let dy = 0;

  if (mode.startsWith('top')) {
    dx = stockMinX + marginMm - bounds.minX;
  } else if (mode.startsWith('bottom')) {
    dx = stockMaxX - marginMm - bounds.maxX;
  } else {
    dx = (stockMinX + stockMaxX) / 2 - (bounds.minX + bounds.maxX) / 2;
  }

  if (mode.endsWith('Left')) {
    dy = stockMinY + marginMm - bounds.minY;
  } else if (mode.endsWith('Right')) {
    dy = stockMaxY - marginMm - bounds.maxY;
  } else {
    dy = (stockMinY + stockMaxY) / 2 - (bounds.minY + bounds.maxY) / 2;
  }

  return { dx, dy };
}

export function translateObjectsList(objs: CADObject[], dx: number, dy: number): CADObject[] {
  return objs.map((o) => translateCADObject(o, dx, dy));
}

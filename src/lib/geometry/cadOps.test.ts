import { describe, expect, it } from 'vitest';
import {
  ArcObject,
  CircleObject,
  LineObject,
  PolylineObject,
  RectangleObject,
  StockSheetSettings,
} from '../../types';
import {
  computeStockAlignmentDelta,
  computeTrimOperation,
  computeTwoLineFillet,
  joinSelectedContours,
} from './cadOps';
import { rotateCADObject } from './transform';
import {
  parseDXFContent,
  parseSVGContent,
  prepareVectorImportObjects,
} from '../import/vectorImport';

const mkLine = (
  id: string,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): LineObject => ({
  id,
  name: id,
  type: 'line',
  startX,
  startY,
  endX,
  endY,
  depth: 10,
  operationType: 'cut',
});

describe('computeTrimOperation (Ножницы)', () => {
  it('укорачивает конец отрезка при пересечении с другим отрезком', () => {
    const l1 = mkLine('l1', 0, 0, 100, 0);
    const l2 = mkLine('l2', 50, -50, 50, 50);
    const res = computeTrimOperation(l1, { x: 80, y: 0 }, [l1, l2]);
    expect(res).not.toBeNull();
    expect(res!.replacements).toHaveLength(1);
    const rep = res!.replacements[0] as LineObject;
    expect(rep.type).toBe('line');
    expect(rep.startX).toBeCloseTo(0, 3);
    expect(rep.endX).toBeCloseTo(50, 3);
  });

  it('вырезает средний участок отрезка между двумя пересечениями, давая 2 новых отрезка', () => {
    const l1 = mkLine('l1', 0, 0, 120, 0);
    const cut1 = mkLine('c1', 40, -30, 40, 30);
    const cut2 = mkLine('c2', 80, -30, 80, 30);
    const res = computeTrimOperation(l1, { x: 60, y: 0 }, [l1, cut1, cut2]);
    expect(res).not.toBeNull();
    expect(res!.replacements).toHaveLength(2);
    const [a, b] = res!.replacements as LineObject[];
    expect(a.startX).toBeCloseTo(0, 3);
    expect(a.endX).toBeCloseTo(40, 3);
    expect(b.startX).toBeCloseTo(80, 3);
    expect(b.endX).toBeCloseTo(120, 3);
  });

  it('обрезает окружность двумя пересечениями с отрезком, превращая её в дугу', () => {
    const circle: CircleObject = {
      id: 'cir',
      name: 'Круг',
      type: 'circle',
      centerX: 0,
      centerY: 0,
      radius: 50,
      depth: 10,
      operationType: 'cut',
    };
    const chord = mkLine('ch', -100, 0, 100, 0);
    const res = computeTrimOperation(circle, { x: 0, y: 50 }, [circle, chord]);
    expect(res).not.toBeNull();
    expect(res!.replacements).toHaveLength(1);
    const arc = res!.replacements[0] as ArcObject;
    expect(arc.type).toBe('arc');
    expect(arc.centerX).toBeCloseTo(0, 3);
    expect(arc.centerY).toBeCloseTo(0, 3);
    expect(arc.radius).toBeCloseTo(50, 3);
  });

  it('обрезает участок дуги до пересечения с линией', () => {
    const arc: ArcObject = {
      id: 'a1',
      name: 'Дуга',
      type: 'arc',
      centerX: 0,
      centerY: 0,
      radius: 100,
      startX: 100,
      startY: 0,
      endX: 0,
      endY: 100,
      clockwise: false,
      depth: 10,
      operationType: 'cut',
    };
    const diag = mkLine('d', 0, 0, 100, 100);
    const res = computeTrimOperation(arc, { x: 92, y: 38 }, [arc, diag]);
    expect(res).not.toBeNull();
    expect(res!.replacements).toHaveLength(1);
    const kept = res!.replacements[0] as ArcObject;
    expect(kept.type).toBe('arc');
    const midAngle = Math.PI / 4;
    expect(kept.startX).toBeCloseTo(100 * Math.cos(midAngle), 2);
    expect(kept.startY).toBeCloseTo(100 * Math.sin(midAngle), 2);
    expect(kept.endX).toBeCloseTo(0, 2);
    expect(kept.endY).toBeCloseTo(100, 2);
  });
});

describe('computeTwoLineFillet (Скругление двух линий)', () => {
  it('строит касательную дугу R=10 в L-углу и подрезает концы', () => {
    const l1 = mkLine('l1', 0, 0, 100, 0);
    const l2 = mkLine('l2', 0, 0, 0, 100);
    const outcome = computeTwoLineFillet(l1, l2, 10);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.arc.centerX).toBeCloseTo(10, 3);
    expect(outcome.result.arc.centerY).toBeCloseTo(10, 3);
    expect(outcome.result.arc.radius).toBeCloseTo(10, 3);
    expect(outcome.result.lineA.startX).toBeCloseTo(10, 3);
    expect(outcome.result.lineA.startY).toBeCloseTo(0, 3);
    expect(outcome.result.lineB.startX).toBeCloseTo(0, 3);
    expect(outcome.result.lineB.startY).toBeCloseTo(10, 3);
  });

  it('учитывает сторону клика для X-пересечения', () => {
    const l1 = mkLine('l1', -50, 0, 50, 0);
    const l2 = mkLine('l2', 0, -50, 0, 50);
    const outcome = computeTwoLineFillet(l1, l2, 10, { x: -30, y: 0 }, { x: 0, y: 30 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.arc.centerX).toBeCloseTo(-10, 3);
    expect(outcome.result.arc.centerY).toBeCloseTo(10, 3);
  });

  it('возвращает понятную ошибку для параллельных линий и слишком большого радиуса', () => {
    const p1 = mkLine('p1', 0, 0, 100, 0);
    const p2 = mkLine('p2', 0, 20, 100, 20);
    const parallel = computeTwoLineFillet(p1, p2, 10);
    expect(parallel.ok).toBe(false);

    const short1 = mkLine('s1', 0, 0, 15, 0);
    const short2 = mkLine('s2', 0, 0, 0, 15);
    const tooBig = computeTwoLineFillet(short1, short2, 20);
    expect(tooBig.ok).toBe(false);
  });
});

describe('joinSelectedContours (Объединение контуров)', () => {
  it('склеивает отрезки в произвольном порядке и ориентации в замкнутый контур', () => {
    const a = mkLine('a', 0, 0, 100, 0);
    const b = mkLine('b', 100, 50, 100, 0); // обратная ориентация
    const c = mkLine('c', 100, 50, 0, 50);
    const d = mkLine('d', 0, 0, 0, 50); // обратная ориентация
    const lone = mkLine('lone', 500, 500, 600, 500);

    const res = joinSelectedContours([a, c, lone, b, d], 0.5);
    expect(res.consumedIds.sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(res.joinedPolylines).toHaveLength(1);
    const poly = res.joinedPolylines[0] as PolylineObject;
    expect(poly.type).toBe('polyline');
    expect(poly.closed).toBe(true);
    expect(poly.points).toHaveLength(4);
  });
});

describe('rotateCADObject (Произвольный поворот)', () => {
  it('сохраняет RectangleObject при повороте на 90°', () => {
    const rect: RectangleObject = {
      id: 'r1',
      name: 'R',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      cornerRadius: 8,
      depth: 10,
      operationType: 'cut',
    };
    const rotated = rotateCADObject(rect, 90, { x: 50, y: 25 });
    expect(rotated.type).toBe('rectangle');
    if (rotated.type === 'rectangle') {
      expect(rotated.width).toBeCloseTo(50, 3);
      expect(rotated.height).toBeCloseTo(100, 3);
      expect(rotated.cornerRadius).toBeCloseTo(8, 3);
    }
  });

  it('конвертирует прямоугольник со скруглением в замкнутую полилинию на 45°', () => {
    const rect: RectangleObject = {
      id: 'r1',
      name: 'R',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      cornerRadius: 10,
      depth: 10,
      operationType: 'cut',
    };
    const rotated = rotateCADObject(rect, 45, { x: 50, y: 25 });
    expect(rotated.type).toBe('polyline');
    if (rotated.type === 'polyline') {
      expect(rotated.closed).toBe(true);
      expect(rotated.points.length).toBeGreaterThan(8);
    }
  });
});

describe('computeStockAlignmentDelta (Выравнивание по листу ДСП)', () => {
  const stock: StockSheetSettings = {
    enabled: true,
    preset: 'custom',
    widthX: 1000,
    widthY: 2000,
    color: '#22c55e',
  };
  const box: RectangleObject = {
    id: 'r1',
    name: 'Box',
    type: 'rectangle',
    x: -100,
    y: -100,
    width: 100,
    height: 100,
    depth: 10,
    operationType: 'cut',
  };

  it('центрирует блок в [-widthX..0] × [-widthY..0]', () => {
    const delta = computeStockAlignmentDelta([box], stock, 'center', 0);
    expect(delta).not.toBeNull();
    // box center = (-50, -50), stock center = (-500, -1000) -> dx = -450, dy = -950
    expect(delta!.dx).toBeCloseTo(-450, 3);
    expect(delta!.dy).toBeCloseTo(-950, 3);
  });

  it('прижимает к верхнему левому углу с отступом 20 мм', () => {
    const delta = computeStockAlignmentDelta([box], stock, 'topLeft', 20);
    expect(delta).not.toBeNull();
    // minX = -1000 + 20 = -980 (was -100 -> -880); minY = -2000 + 20 = -1980 (was -100 -> -1880)
    expect(delta!.dx).toBeCloseTo(-880, 3);
    expect(delta!.dy).toBeCloseTo(-1880, 3);
  });

  it('прижимает к нижнему правому углу с отступом 15 мм', () => {
    const delta = computeStockAlignmentDelta([box], stock, 'bottomRight', 15);
    expect(delta).not.toBeNull();
    // maxX = -15 (was 0 -> -15); maxY = -15 (was 0 -> -15)
    expect(delta!.dx).toBeCloseTo(-15, 3);
    expect(delta!.dy).toBeCloseTo(-15, 3);
  });
});

describe('DXF & SVG импорт контуров', () => {
  it('парсит DXF: $INSUNITS=1 (дюймы -> масштаб 25.4), LINE, LWPOLYLINE с bulge, CIRCLE, ARC', () => {
    const dxf = [
      '0', 'SECTION', '2', 'HEADER',
      '9', '$INSUNITS', '70', '1',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LINE', '10', '0', '20', '0', '11', '10', '21', '0',
      '0', 'CIRCLE', '10', '5', '20', '5', '40', '2',
      '0', 'ARC', '10', '0', '20', '0', '40', '5', '50', '0', '51', '90',
      '0', 'LWPOLYLINE', '70', '1',
      '10', '0', '20', '0', '42', '0',
      '10', '4', '20', '0', '42', '1',
      '10', '4', '20', '4', '42', '0',
      '10', '0', '20', '4',
      '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n');

    const summary = parseDXFContent(dxf, 16);
    expect(summary.suggestedScale).toBeCloseTo(25.4, 3);
    expect(summary.counts.lines).toBeGreaterThanOrEqual(4);
    expect(summary.counts.circles).toBe(1);
    expect(summary.counts.arcs).toBeGreaterThanOrEqual(2); // ARC + bulge 1 -> полукруг
  });

  it('парсит SVG: <rect rx>, <circle> и <path M L C A Z>', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="100mm" viewBox="0 0 200 100">
        <rect x="10" y="10" width="80" height="40" rx="5" />
        <circle cx="150" cy="50" r="15" />
        <path d="M 10 60 L 50 60 C 60 60 70 70 70 80 A 10 10 0 0 1 60 90 Z" />
      </svg>
    `;
    const summary = parseSVGContent(svg, 16);
    expect(summary.counts.rectangles).toBe(1);
    expect(summary.counts.circles).toBe(1);
    expect(summary.counts.polylines).toBe(1);

    const prepared = prepareVectorImportObjects(summary, {
      scale: 1,
      autoJoin: false,
      placement: 'sheetCenter',
      marginMm: 20,
      stockSheet: { enabled: true, preset: 'custom', widthX: 1000, widthY: 2000, color: '#22c55e' },
      defaultDepth: 12,
    });
    expect(prepared.length).toBeGreaterThanOrEqual(3);
    expect(prepared.every((o) => o.depth === 12)).toBe(true);
  });
});

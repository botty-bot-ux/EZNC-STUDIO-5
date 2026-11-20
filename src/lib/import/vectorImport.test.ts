import { describe, expect, it } from 'vitest';
import {
  parseDXFContent,
  parseSVGContent,
  prepareVectorImportObjects,
} from './vectorImport';
import { computeObjectsBounds } from '../geometry/transform';
import { CADObject } from '../../types';

function makeDxf(entitiesBody: string, headerBody = ''): string {
  const parts: string[] = [];
  if (headerBody) {
    parts.push('0', 'SECTION', '2', 'HEADER', headerBody.trim(), '0', 'ENDSEC');
  }
  parts.push('0', 'SECTION', '2', 'ENTITIES', entitiesBody.trim(), '0', 'ENDSEC', '0', 'EOF');
  return parts.join('\n');
}

describe('parseDXFContent', () => {
  it('разбирает LINE, CIRCLE, ARC и корректно переводит DXF (dx, dy) → world (-dy, dx)', () => {
    const dxf = makeDxf(`
0
LINE
10
100
20
50
11
300
21
50
0
CIRCLE
10
200
20
100
40
25
0
ARC
10
0
20
0
40
50
50
0
51
90
`);
    const res = parseDXFContent(dxf, 16);
    expect(res.sourceFormat).toBe('dxf');
    expect(res.counts).toEqual({
      lines: 1,
      polylines: 0,
      rectangles: 0,
      arcs: 1,
      circles: 1,
    });
    expect(res.objects).toHaveLength(3);

    const line = res.objects[0];
    expect(line.type).toBe('line');
    if (line.type === 'line') {
      expect(line.startX).toBeCloseTo(-50, 4);
      expect(line.startY).toBeCloseTo(100, 4);
      expect(line.endX).toBeCloseTo(-50, 4);
      expect(line.endY).toBeCloseTo(300, 4);
      expect(line.depth).toBe(16);
    }

    const circle = res.objects[1];
    expect(circle.type).toBe('circle');
    if (circle.type === 'circle') {
      expect(circle.centerX).toBeCloseTo(-100, 4);
      expect(circle.centerY).toBeCloseTo(200, 4);
      expect(circle.radius).toBeCloseTo(25, 4);
    }

    const arc = res.objects[2];
    expect(arc.type).toBe('arc');
    if (arc.type === 'arc') {
      expect(arc.centerX).toBeCloseTo(0, 4);
      expect(arc.centerY).toBeCloseTo(0, 4);
      expect(arc.radius).toBeCloseTo(50, 4);
      expect(arc.clockwise).toBe(false);
    }
  });

  it('разбирает замкнутую LWPOLYLINE и LWPOLYLINE с bulge (дуговыми сегментами)', () => {
    const dxf = makeDxf(`
0
LWPOLYLINE
70
1
10
0
20
0
10
100
20
0
10
100
20
50
10
0
20
50
0
LWPOLYLINE
70
0
10
0
20
0
42
1
10
100
20
0
`);
    const res = parseDXFContent(dxf, 17.5);
    expect(res.counts.polylines).toBe(1);
    expect(res.counts.arcs).toBe(1);

    const poly = res.objects.find((o) => o.type === 'polyline');
    expect(poly?.type).toBe('polyline');
    if (poly?.type === 'polyline') {
      expect(poly.closed).toBe(true);
      expect(poly.points).toHaveLength(4);
    }

    const bulgeArc = res.objects.find((o) => o.type === 'arc');
    expect(bulgeArc?.type).toBe('arc');
    if (bulgeArc?.type === 'arc') {
      // Полукруг (bulge = 1) на хорде длиной 100 → радиус 50, CCW (clockwise=false)
      expect(bulgeArc.radius).toBeCloseTo(50, 3);
      expect(bulgeArc.clockwise).toBe(false);
    }
  });

  it('разбирает классическую POLYLINE → VERTEX → SEQEND и читает $INSUNITS (дюймы)', () => {
    const dxf = makeDxf(
      `
0
POLYLINE
70
0
0
VERTEX
10
0
20
0
0
VERTEX
10
10
20
0
0
VERTEX
10
10
20
20
0
SEQEND
`,
      `
9
$INSUNITS
70
1
`
    );
    const res = parseDXFContent(dxf, 12);
    expect(res.suggestedScale).toBeCloseTo(25.4, 4);
    expect(res.counts.polylines).toBe(1);
    expect(res.rawBounds).not.toBeNull();
  });

  it('возвращает предупреждение на пустой или повреждённый DXF', () => {
    const res = parseDXFContent('NOT A DXF FILE');
    expect(res.objects).toHaveLength(0);
    expect(res.rawBounds).toBeNull();
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe('parseSVGContent', () => {
  it('разбирает базовые примитивы SVG (rect, circle, line, polygon) с физическими единицами в мм', () => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="100mm" viewBox="0 0 200 100">
  <defs><rect x="0" y="0" width="999" height="999" /></defs>
  <rect x="10" y="20" width="80" height="40" rx="5" />
  <circle cx="150" cy="50" r="15" />
  <line x1="0" y1="0" x2="50" y2="50" />
  <polygon points="10,10 30,10 20,30" />
  <rect x="0" y="0" width="10" height="10" display="none" />
</svg>
`;
    const res = parseSVGContent(svg, 17.5);
    expect(res.sourceFormat).toBe('svg');
    expect(res.warnings).toHaveLength(0);
    // defs и display="none" должны быть проигнорированы
    expect(res.objects).toHaveLength(4);
    expect(res.counts.rectangles).toBe(1);
    expect(res.counts.circles).toBe(1);
    expect(res.counts.lines).toBe(1);
    expect(res.counts.polylines).toBe(1);

    const rect = res.objects.find((o) => o.type === 'rectangle');
    if (rect?.type === 'rectangle') {
      expect(rect.cornerRadius).toBeCloseTo(5, 3);
    }

    const circle = res.objects.find((o) => o.type === 'circle');
    if (circle?.type === 'circle') {
      expect(circle.radius).toBeCloseTo(15, 3);
    }
  });

  it('разбирает <path> (M/L/H/V/C/Z) и применяет групповой transform="translate(...) scale(...)"', () => {
    const svg = `
<svg viewBox="0 0 100 100">
  <g transform="translate(10, 20) scale(2)">
    <path d="M 0 0 L 10 0 H 20 V 10 C 20 15 10 15 0 10 Z" />
  </g>
</svg>
`;
    const res = parseSVGContent(svg, 10);
    expect(res.objects.length).toBeGreaterThan(0);
    expect(res.rawBounds).not.toBeNull();
    // Без width с viewBox → 1 ед. = 1 мм; после scale(2) ширина 20 → 40 мм по worldY
    if (res.rawBounds) {
      expect(res.rawBounds.maxY - res.rawBounds.minY).toBeCloseTo(40, 1);
    }
  });

  it('возвращает ошибку при отсутствии корневого <svg>', () => {
    const res = parseSVGContent('<div>not svg</div>');
    expect(res.objects).toHaveLength(0);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe('prepareVectorImportObjects', () => {
  it('масштабирует, склеивает соприкасающиеся отрезки (autoJoin) и центрирует на листе ДСП', () => {
    const dxf = makeDxf(`
0
LINE
10
0
20
0
11
100
21
0
0
LINE
10
100
20
0
11
100
21
50
`);
    const summary = parseDXFContent(dxf, 5);
    expect(summary.objects).toHaveLength(2);

    const prepared = prepareVectorImportObjects(summary, {
      scale: 2,
      autoJoin: true,
      placement: 'sheetCenter',
      marginMm: 20,
      stockSheet: {
        enabled: true,
        preset: 'custom',
        widthX: 1000,
        widthY: 2000,
      },
      defaultDepth: 17.5,
    });

    // Два соприкасающихся отрезка склеились в 1 полилинию без временных id
    expect(prepared).toHaveLength(1);
    expect(prepared[0].type).toBe('polyline');
    expect(prepared[0].depth).toBe(17.5);
    expect('id' in prepared[0]).toBe(false);

    const bounds = computeObjectsBounds(
      prepared.map((o, i) => ({ ...o, id: `t_${i}` }) as CADObject)
    );
    expect(bounds).not.toBeNull();
    if (bounds) {
      // Размер удвоен (scale=2): 50*2 = 100 по X, 100*2 = 200 по Y
      expect(bounds.maxX - bounds.minX).toBeCloseTo(100, 2);
      expect(bounds.maxY - bounds.minY).toBeCloseTo(200, 2);
      // Центр совпадает с центром листа (-widthX/2, -widthY/2) = (-500, -1000)
      expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(-500, 2);
      expect((bounds.minY + bounds.maxY) / 2).toBeCloseTo(-1000, 2);
    }
  });

  it('размещает с отступом sheetMargin от угла (0,0) внутрь заготовки (-X, -Y)', () => {
    const summary = parseSVGContent(
      '<svg viewBox="0 0 100 50"><rect x="0" y="0" width="100" height="50" /></svg>',
      10
    );
    const prepared = prepareVectorImportObjects(summary, {
      scale: 1,
      autoJoin: false,
      placement: 'sheetMargin',
      marginMm: 25,
      defaultDepth: 12,
    });
    const bounds = computeObjectsBounds(
      prepared.map((o, i) => ({ ...o, id: `t_${i}` }) as CADObject)
    );
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.maxX).toBeCloseTo(-25, 2);
      expect(bounds.maxY).toBeCloseTo(-25, 2);
    }
  });
});

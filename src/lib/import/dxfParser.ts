import { NewCADObjectInput, Point2D } from '../../types';
import { ImportedVectorSummary, summarizeObjects } from './vectorImport.types';

// ---------------------------------------------------------------------------
// Парсер ASCII DXF (LINE, LWPOLYLINE, POLYLINE/VERTEX, CIRCLE, ARC)
// ---------------------------------------------------------------------------

// DXF: +X вправо, +Y вверх. На холсте EZNC: вправо = +worldY, вверх = -worldX.
// Отображение (dx, dy) -> { x: -dy, y: dx } имеет det = +1 (поворот на 90° без
// зеркалирования), поэтому углы дуг и направление G02/G03 сохраняются точно.
function dxfPt(dx: number, dy: number): Point2D {
  return { x: -dy, y: dx };
}

function buildBulgeSegment(
  p1: Point2D,
  p2: Point2D,
  bulge: number,
  depth: number,
  name: string
): NewCADObjectInput {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-4 || Math.abs(bulge) < 1e-4) {
    return {
      name,
      type: 'line',
      startX: p1.x,
      startY: p1.y,
      endX: p2.x,
      endY: p2.y,
      depth,
      operationType: 'cut',
      visible: true,
    };
  }
  const theta = 4 * Math.atan(bulge);
  const absHalf = Math.abs(theta) / 2;
  const radius = chord / (2 * Math.sin(absHalf));
  const distToCenter = radius * Math.cos(absHalf);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  // Нормаль влево от направления p1 -> p2 в мировой системе
  const nx = -dy / chord;
  const ny = dx / chord;
  // В DXF положительный bulge = CCW дуга, значит центр лежит слева при |theta|<π и справа при >π
  const sign = (bulge > 0 ? 1 : -1) * (Math.abs(theta) <= Math.PI ? 1 : -1);
  const cx = mx + nx * distToCenter * sign;
  const cy = my + ny * distToCenter * sign;
  return {
    name,
    type: 'arc',
    startX: p1.x,
    startY: p1.y,
    endX: p2.x,
    endY: p2.y,
    centerX: cx,
    centerY: cy,
    radius,
    clockwise: bulge < 0,
    depth,
    operationType: 'cut',
    visible: true,
  };
}

export function parseDXFContent(
  content: string,
  defaultDepth: number = 17.5
): ImportedVectorSummary {
  const lines = content.split(/\r?\n/);
  const pairs: Array<{ code: number; value: string }> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (!Number.isFinite(code)) continue;
    pairs.push({ code, value: lines[i + 1].trim() });
  }

  let inHeader = false;
  let inEntities = false;
  let headerVar = '';
  let insUnits = 0;

  let curEntity: string | null = null;
  let props: Array<{ code: number; value: string }> = [];

  // Для классической POLYLINE -> VERTEX -> SEQEND
  let polyOpen = false;
  let polyClosed = false;
  let polyVerts: Array<{ x: number; y: number; bulge: number }> = [];

  const objects: NewCADObjectInput[] = [];
  const warnings: string[] = [];

  const flushPolyEntity = (
    verts: Array<{ x: number; y: number; bulge: number }>,
    closed: boolean
  ) => {
    if (verts.length < 2) return;
    const hasBulge = verts.some((v) => Math.abs(v.bulge) > 1e-4);
    const pts = verts.map((v) => dxfPt(v.x, v.y));

    if (!hasBulge) {
      objects.push({
        name: `${closed ? 'Контур' : 'Полилиния'} DXF ${objects.length + 1}`,
        type: 'polyline',
        points: pts,
        closed,
        depth: defaultDepth,
        operationType: 'cut',
        visible: true,
      });
      return;
    }

    const segCount = closed ? verts.length : verts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const v1 = verts[i];
      const v2 = verts[(i + 1) % verts.length];
      const p1 = dxfPt(v1.x, v1.y);
      const p2 = dxfPt(v2.x, v2.y);
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 1e-4) continue;
      if (Math.abs(v1.bulge) > 1e-4) {
        objects.push(
          buildBulgeSegment(p1, p2, v1.bulge, defaultDepth, `Дуга DXF ${objects.length + 1}`)
        );
      } else {
        objects.push({
          name: `Отрезок DXF ${objects.length + 1}`,
          type: 'line',
          startX: p1.x,
          startY: p1.y,
          endX: p2.x,
          endY: p2.y,
          depth: defaultDepth,
          operationType: 'cut',
          visible: true,
        });
      }
    }
  };

  const flushEntity = () => {
    if (!curEntity) return;
    const getNum = (c: number, def = 0): number => {
      const f = props.find((p) => p.code === c);
      if (!f) return def;
      const n = parseFloat(f.value);
      return Number.isFinite(n) ? n : def;
    };

    if (curEntity === 'LINE') {
      const p1 = dxfPt(getNum(10), getNum(20));
      const p2 = dxfPt(getNum(11), getNum(21));
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.01) {
        objects.push({
          name: `Отрезок DXF ${objects.length + 1}`,
          type: 'line',
          startX: p1.x,
          startY: p1.y,
          endX: p2.x,
          endY: p2.y,
          depth: defaultDepth,
          operationType: 'cut',
          visible: true,
        });
      }
    } else if (curEntity === 'CIRCLE') {
      const c = dxfPt(getNum(10), getNum(20));
      const r = Math.abs(getNum(40));
      if (r > 0.05) {
        objects.push({
          name: `Окружность R${r.toFixed(1)}`,
          type: 'circle',
          centerX: c.x,
          centerY: c.y,
          radius: r,
          depth: defaultDepth,
          operationType: 'cut',
          visible: true,
        });
      }
    } else if (curEntity === 'ARC') {
      const dcx = getNum(10);
      const dcy = getNum(20);
      const r = Math.abs(getNum(40));
      const a0Deg = getNum(50);
      const a1Deg = getNum(51);
      if (r > 0.05) {
        const a0 = (a0Deg * Math.PI) / 180;
        const a1 = (a1Deg * Math.PI) / 180;
        const pStart = dxfPt(dcx + r * Math.cos(a0), dcy + r * Math.sin(a0));
        const pEnd = dxfPt(dcx + r * Math.cos(a1), dcy + r * Math.sin(a1));
        const c = dxfPt(dcx, dcy);
        objects.push({
          name: `Дуга R${r.toFixed(1)}`,
          type: 'arc',
          startX: pStart.x,
          startY: pStart.y,
          endX: pEnd.x,
          endY: pEnd.y,
          centerX: c.x,
          centerY: c.y,
          radius: r,
          clockwise: false,
          depth: defaultDepth,
          operationType: 'cut',
          visible: true,
        });
      }
    } else if (curEntity === 'LWPOLYLINE') {
      const flag = getNum(70);
      const closed = (Math.round(flag) & 1) === 1;
      const verts: Array<{ x: number; y: number; bulge: number }> = [];
      for (const p of props) {
        if (p.code === 10) {
          verts.push({ x: parseFloat(p.value) || 0, y: 0, bulge: 0 });
        } else if (p.code === 20 && verts.length > 0) {
          verts[verts.length - 1].y = parseFloat(p.value) || 0;
        } else if (p.code === 42 && verts.length > 0) {
          verts[verts.length - 1].bulge = parseFloat(p.value) || 0;
        }
      }
      flushPolyEntity(verts, closed);
    } else if (curEntity === 'POLYLINE') {
      polyOpen = true;
      polyClosed = (Math.round(getNum(70)) & 1) === 1;
      polyVerts = [];
    } else if (curEntity === 'VERTEX' && polyOpen) {
      polyVerts.push({ x: getNum(10), y: getNum(20), bulge: getNum(42) });
    } else if (curEntity === 'SEQEND' && polyOpen) {
      flushPolyEntity(polyVerts, polyClosed);
      polyOpen = false;
      polyVerts = [];
    }

    curEntity = null;
    props = [];
  };

  for (let i = 0; i < pairs.length; i++) {
    const { code, value } = pairs[i];
    if (code === 0 && value === 'SECTION') {
      const next = pairs[i + 1];
      if (next?.code === 2) {
        inHeader = next.value === 'HEADER';
        inEntities = next.value === 'ENTITIES';
        i++;
      }
      continue;
    }
    if (code === 0 && value === 'ENDSEC') {
      flushEntity();
      inHeader = false;
      inEntities = false;
      continue;
    }
    if (inHeader) {
      if (code === 9) headerVar = value;
      else if (headerVar === '$INSUNITS' && code === 70) {
        insUnits = parseInt(value, 10) || 0;
      }
      continue;
    }
    if (!inEntities) continue;

    if (code === 0) {
      flushEntity();
      curEntity = value;
      props = [];
    } else if (curEntity) {
      props.push({ code, value });
    }
  }
  flushEntity();

  let suggestedScale = 1;
  let detectedUnitNote = 'Единицы: мм (1:1)';
  if (insUnits === 1) {
    suggestedScale = 25.4;
    detectedUnitNote = 'Дюймы ($INSUNITS=1) → ×25.4 мм';
  } else if (insUnits === 5) {
    suggestedScale = 10;
    detectedUnitNote = 'Сантиметры ($INSUNITS=5) → ×10 мм';
  } else if (insUnits === 6) {
    suggestedScale = 1000;
    detectedUnitNote = 'Метры ($INSUNITS=6) → ×1000 мм';
  }

  if (objects.length === 0) {
    warnings.push('В секции ENTITIES не найдено поддерживаемых 2D-примитивов (LINE, ARC, CIRCLE, LWPOLYLINE).');
  }

  const { counts, rawBounds } = summarizeObjects(objects);
  return {
    objects,
    rawBounds,
    counts,
    warnings,
    sourceFormat: 'dxf',
    detectedUnitNote,
    suggestedScale,
  };
}

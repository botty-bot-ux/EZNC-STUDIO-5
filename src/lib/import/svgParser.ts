import { NewCADObjectInput, Point2D } from '../../types';
import { ImportedVectorSummary, summarizeObjects } from './vectorImport.types';

// ---------------------------------------------------------------------------
// Парсер SVG (path, line, rect, circle, ellipse, polyline, polygon)
// ---------------------------------------------------------------------------

type Matrix2D = [number, number, number, number, number, number]; // [a, b, c, d, e, f]

const IDENTITY: Matrix2D = [1, 0, 0, 1, 0, 0];

function mulMatrix(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrix(m: Matrix2D, x: number, y: number): Point2D {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

function parseSvgTransform(attr: string | null): Matrix2D {
  if (!attr) return IDENTITY;
  let out: Matrix2D = [...IDENTITY];
  const fnRe = /([a-zA-Z]+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(attr)) !== null) {
    const fn = m[1].toLowerCase();
    const nums = m[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(parseFloat)
      .filter(Number.isFinite);
    let t: Matrix2D = IDENTITY;
    if (fn === 'translate' && nums.length >= 1) {
      t = [1, 0, 0, 1, nums[0], nums[1] ?? 0];
    } else if (fn === 'scale' && nums.length >= 1) {
      t = [nums[0], 0, 0, nums[1] ?? nums[0], 0, 0];
    } else if (fn === 'rotate' && nums.length >= 1) {
      const rad = (nums[0] * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (nums.length >= 3) {
        const cx = nums[1];
        const cy = nums[2];
        t = mulMatrix(
          [1, 0, 0, 1, cx, cy],
          mulMatrix([cos, sin, -sin, cos, 0, 0], [1, 0, 0, 1, -cx, -cy])
        );
      } else {
        t = [cos, sin, -sin, cos, 0, 0];
      }
    } else if (fn === 'matrix' && nums.length === 6) {
      t = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
    } else if (fn === 'skewx' && nums.length >= 1) {
      t = [1, 0, Math.tan((nums[0] * Math.PI) / 180), 1, 0, 0];
    } else if (fn === 'skewy' && nums.length >= 1) {
      t = [1, Math.tan((nums[0] * Math.PI) / 180), 0, 1, 0, 0];
    }
    out = mulMatrix(out, t);
  }
  return out;
}

// В SVG: +X вправо, +Y вниз. В мире EZNC: экран право = +worldY, экран низ = +worldX.
function svgToWorldPt(sx: number, sy: number, unitScale: number): Point2D {
  return { x: sy * unitScale, y: sx * unitScale };
}

function tokenizeSvgPath(d: string): string[] {
  return d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
}

function sampleSvgEllipticalArc(
  x0: number,
  y0: number,
  rxIn: number,
  ryIn: number,
  xAxisRotDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  x1: number,
  y1: number,
  steps: number = 24
): Array<{ x: number; y: number }> {
  if (Math.hypot(x1 - x0, y1 - y0) < 1e-6) return [{ x: x1, y: y1 }];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx < 1e-6 || ry < 1e-6) return [{ x: x1, y: y1 }];

  const phi = (xAxisRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x0 - x1) / 2;
  const dy2 = (y0 - y1) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den = rx2 * y1p2 + ry2 * x1p2;
  const factor = den > 1e-12 ? Math.sqrt(num / den) : 0;
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const cxp = (sign * factor * rx * y1p) / ry;
  const cyp = (sign * factor * -ry * x1p) / rx;

  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;

  const vecAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
    const ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    return ux * vy - uy * vx < 0 ? -ang : ang;
  };

  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  const theta1 = vecAngle(1, 0, ux, uy);
  let dTheta = vecAngle(ux, uy, vx, vy);
  if (!sweepFlag && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag && dTheta < 0) dTheta += 2 * Math.PI;

  const n = Math.max(6, Math.round((Math.abs(dTheta) / (Math.PI * 2)) * steps * 2));
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 1; i <= n; i++) {
    const t = theta1 + (dTheta * i) / n;
    const px = cosPhi * rx * Math.cos(t) - sinPhi * ry * Math.sin(t) + cx;
    const py = sinPhi * rx * Math.cos(t) + cosPhi * ry * Math.sin(t) + cy;
    out.push({ x: px, y: py });
  }
  return out;
}

function svgPathToSubpaths(d: string): Array<{ pts: Array<{ x: number; y: number }>; closed: boolean }> {
  const tokens = tokenizeSvgPath(d);
  const subpaths: Array<{ pts: Array<{ x: number; y: number }>; closed: boolean }> = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  let lastCmd = '';
  let current: { pts: Array<{ x: number; y: number }>; closed: boolean } | null = null;

  const nextNum = () => parseFloat(tokens[i++]);
  const isNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);

  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) {
      cmd = tokens[i++];
    } else if (cmd === 'M') {
      cmd = 'L';
    } else if (cmd === 'm') {
      cmd = 'l';
    }

    if (cmd === 'Z' || cmd === 'z') {
      if (current) {
        current.closed = true;
        cx = sx;
        cy = sy;
      }
      lastCmd = cmd;
      continue;
    }

    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();

    if (upper === 'M') {
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      cx = x;
      cy = y;
      sx = x;
      sy = y;
      current = { pts: [{ x, y }], closed: false };
      subpaths.push(current);
      cmd = rel ? 'l' : 'L';
      lastCmd = upper;
      continue;
    }

    if (!current) {
      current = { pts: [{ x: cx, y: cy }], closed: false };
      subpaths.push(current);
    }

    if (upper === 'L') {
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      cx = x;
      cy = y;
      current.pts.push({ x, y });
    } else if (upper === 'H') {
      const x = nextNum() + (rel ? cx : 0);
      cx = x;
      current.pts.push({ x: cx, y: cy });
    } else if (upper === 'V') {
      const y = nextNum() + (rel ? cy : 0);
      cy = y;
      current.pts.push({ x: cx, y: cy });
    } else if (upper === 'C') {
      const x1 = nextNum() + (rel ? cx : 0);
      const y1 = nextNum() + (rel ? cy : 0);
      const x2 = nextNum() + (rel ? cx : 0);
      const y2 = nextNum() + (rel ? cy : 0);
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      for (let s = 1; s <= 12; s++) {
        const t = s / 12;
        const u = 1 - t;
        current.pts.push({
          x: u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          y: u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        });
      }
      lastCtrlX = x2;
      lastCtrlY = y2;
      cx = x;
      cy = y;
    } else if (upper === 'S') {
      const x1 = lastCmd === 'C' || lastCmd === 'S' ? 2 * cx - lastCtrlX : cx;
      const y1 = lastCmd === 'C' || lastCmd === 'S' ? 2 * cy - lastCtrlY : cy;
      const x2 = nextNum() + (rel ? cx : 0);
      const y2 = nextNum() + (rel ? cy : 0);
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      for (let s = 1; s <= 12; s++) {
        const t = s / 12;
        const u = 1 - t;
        current.pts.push({
          x: u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          y: u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        });
      }
      lastCtrlX = x2;
      lastCtrlY = y2;
      cx = x;
      cy = y;
    } else if (upper === 'Q') {
      const x1 = nextNum() + (rel ? cx : 0);
      const y1 = nextNum() + (rel ? cy : 0);
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      for (let s = 1; s <= 10; s++) {
        const t = s / 10;
        const u = 1 - t;
        current.pts.push({
          x: u * u * cx + 2 * u * t * x1 + t * t * x,
          y: u * u * cy + 2 * u * t * y1 + t * t * y,
        });
      }
      lastCtrlX = x1;
      lastCtrlY = y1;
      cx = x;
      cy = y;
    } else if (upper === 'T') {
      const x1 = lastCmd === 'Q' || lastCmd === 'T' ? 2 * cx - lastCtrlX : cx;
      const y1 = lastCmd === 'Q' || lastCmd === 'T' ? 2 * cy - lastCtrlY : cy;
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      for (let s = 1; s <= 10; s++) {
        const t = s / 10;
        const u = 1 - t;
        current.pts.push({
          x: u * u * cx + 2 * u * t * x1 + t * t * x,
          y: u * u * cy + 2 * u * t * y1 + t * t * y,
        });
      }
      lastCtrlX = x1;
      lastCtrlY = y1;
      cx = x;
      cy = y;
    } else if (upper === 'A') {
      const rx = nextNum();
      const ry = nextNum();
      const rot = nextNum();
      const largeArc = nextNum();
      const sweep = nextNum();
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      const arcPts = sampleSvgEllipticalArc(cx, cy, rx, ry, rot, largeArc, sweep, x, y);
      current.pts.push(...arcPts);
      cx = x;
      cy = y;
    } else {
      if (!isNum()) i++;
    }
    lastCmd = upper;
  }

  return subpaths.filter((s) => s.pts.length >= 2);
}

function parseLengthWithUnit(raw: string | null): { value: number; unit: string } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^([-+]?(?:\d*\.\d+|\d+\.?))\s*(mm|cm|in|pt|pc|px)?$/i);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: (m[2] || 'px').toLowerCase() };
}

interface SvgXmlNode {
  tagName: string;
  attrs: Record<string, string>;
  children: SvgXmlNode[];
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseSvgXmlTree(xml: string): SvgXmlNode | null {
  const cleaned = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  const stack: SvgXmlNode[] = [];
  let root: SvgXmlNode | null = null;
  let svgNode: SvgXmlNode | null = null;

  const tagRe = /<\s*(\/?)\s*([a-zA-Z0-9:_-]+)([^>]*?)(\/?)\s*>/g;
  const attrRe = /([a-zA-Z0-9:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(cleaned)) !== null) {
    const isClosing = m[1] === '/';
    const rawTag = m[2];
    const colonIdx = rawTag.indexOf(':');
    const tagName = (colonIdx >= 0 ? rawTag.slice(colonIdx + 1) : rawTag).toLowerCase();
    const attrText = m[3] || '';
    const selfClosing = m[4] === '/';

    if (isClosing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName === tagName) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs: Record<string, string> = {};
    attrRe.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrText)) !== null) {
      attrs[am[1].toLowerCase()] = decodeXmlEntities(am[2] ?? am[3] ?? '');
    }

    const node: SvgXmlNode = { tagName, attrs, children: [] };
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else if (!root) {
      root = node;
    }
    if (tagName === 'svg' && !svgNode) {
      svgNode = node;
    }
    if (!selfClosing) {
      stack.push(node);
    }
  }

  return svgNode ?? (root?.tagName === 'svg' ? root : null);
}

export function parseSVGContent(
  content: string,
  defaultDepth: number = 17.5
): ImportedVectorSummary {
  const warnings: string[] = [];
  const svgEl = parseSvgXmlTree(content);
  if (!svgEl) {
    return {
      objects: [],
      rawBounds: null,
      counts: { lines: 0, polylines: 0, rectangles: 0, arcs: 0, circles: 0 },
      warnings: ['Корневой тег <svg> не найден или структура XML повреждена.'],
      sourceFormat: 'svg',
      suggestedScale: 1,
    };
  }

  const getAttr = (el: SvgXmlNode, name: string): string | null => {
    const v = el.attrs[name.toLowerCase()];
    return v !== undefined ? v : null;
  };

  // Определяем базовый масштаб в миллиметры
  let unitScale = 25.4 / 96; // 96 dpi стандарт SVG
  let detectedUnitNote = 'Единицы SVG: 96 DPI (при необходимости смените масштаб)';
  const wAttr = parseLengthWithUnit(getAttr(svgEl, 'width'));
  const vbRaw = getAttr(svgEl, 'viewBox');
  const vbNums = vbRaw ? vbRaw.trim().split(/[\s,]+/).map(parseFloat).filter(Number.isFinite) : [];

  if (wAttr && wAttr.unit !== 'px') {
    const unitToMm: Record<string, number> = {
      mm: 1,
      cm: 10,
      in: 25.4,
      pt: 25.4 / 72,
      pc: 25.4 / 6,
    };
    const physicalW = wAttr.value * (unitToMm[wAttr.unit] ?? 1);
    const vbW = vbNums.length === 4 && vbNums[2] > 0 ? vbNums[2] : wAttr.value;
    if (vbW > 0) {
      unitScale = physicalW / vbW;
      detectedUnitNote = `Размеры SVG в ${wAttr.unit} (${physicalW.toFixed(1)} мм)`;
    }
  } else if (!wAttr && vbNums.length === 4) {
    unitScale = 1;
    detectedUnitNote = 'ViewBox без единиц → принято 1 ед. = 1 мм';
  }

  const objects: NewCADObjectInput[] = [];

  const numAttr = (el: SvgXmlNode, name: string, def = 0) => {
    const v = parseFloat(getAttr(el, name) ?? '');
    return Number.isFinite(v) ? v : def;
  };

  const walk = (el: SvgXmlNode, parentM: Matrix2D) => {
    const tag = el.tagName;
    if (tag === 'defs' || tag === 'clippath' || tag === 'mask' || tag === 'style' || tag === 'title') {
      return;
    }
    if (getAttr(el, 'display') === 'none') return;

    const m = mulMatrix(parentM, parseSvgTransform(getAttr(el, 'transform')));

    if (tag === 'line') {
      const p1s = applyMatrix(m, numAttr(el, 'x1'), numAttr(el, 'y1'));
      const p2s = applyMatrix(m, numAttr(el, 'x2'), numAttr(el, 'y2'));
      const p1 = svgToWorldPt(p1s.x, p1s.y, unitScale);
      const p2 = svgToWorldPt(p2s.x, p2s.y, unitScale);
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.01) {
        objects.push({
          name: `Отрезок SVG ${objects.length + 1}`,
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
    } else if (tag === 'rect') {
      const x = numAttr(el, 'x');
      const y = numAttr(el, 'y');
      const w = numAttr(el, 'width');
      const h = numAttr(el, 'height');
      const rx = numAttr(el, 'rx', numAttr(el, 'ry'));
      if (w > 0.01 && h > 0.01) {
        // Если нет поворота/сдвига в матрице — создаём нативный RectangleObject (с учётом скругления)
        const isAxisAligned = Math.abs(m[1]) < 1e-6 && Math.abs(m[2]) < 1e-6 && m[0] > 0 && m[3] > 0;
        if (isAxisAligned) {
          const p0s = applyMatrix(m, x, y);
          const p1s = applyMatrix(m, x + w, y + h);
          const p0 = svgToWorldPt(p0s.x, p0s.y, unitScale);
          const p1 = svgToWorldPt(p1s.x, p1s.y, unitScale);
          const cornerRadius = rx > 0 ? rx * m[0] * unitScale : 0;
          objects.push({
            name: `Прямоугольник SVG ${objects.length + 1}`,
            type: 'rectangle',
            x: Math.min(p0.x, p1.x),
            y: Math.min(p0.y, p1.y),
            width: Math.abs(p1.x - p0.x),
            height: Math.abs(p1.y - p0.y),
            ...(cornerRadius > 0.05 ? { cornerRadius } : {}),
            depth: defaultDepth,
            operationType: 'cut',
            visible: true,
          });
        } else {
          const rawCorners = [
            applyMatrix(m, x, y),
            applyMatrix(m, x + w, y),
            applyMatrix(m, x + w, y + h),
            applyMatrix(m, x, y + h),
          ];
          objects.push({
            name: `Контур SVG ${objects.length + 1}`,
            type: 'polyline',
            points: rawCorners.map((p) => svgToWorldPt(p.x, p.y, unitScale)),
            closed: true,
            depth: defaultDepth,
            operationType: 'cut',
            visible: true,
          });
        }
      }
    } else if (tag === 'circle') {
      const cx = numAttr(el, 'cx');
      const cy = numAttr(el, 'cy');
      const r = numAttr(el, 'r');
      const sxScale = Math.hypot(m[0], m[1]);
      const syScale = Math.hypot(m[2], m[3]);
      if (r > 0.01) {
        const cs = applyMatrix(m, cx, cy);
        const c = svgToWorldPt(cs.x, cs.y, unitScale);
        if (Math.abs(sxScale - syScale) < 1e-3) {
          const radMm = r * sxScale * unitScale;
          objects.push({
            name: `Окружность R${radMm.toFixed(1)}`,
            type: 'circle',
            centerX: c.x,
            centerY: c.y,
            radius: radMm,
            depth: defaultDepth,
            operationType: 'cut',
            visible: true,
          });
        } else {
          const pts: Point2D[] = [];
          for (let k = 0; k < 36; k++) {
            const a = (k * Math.PI * 2) / 36;
            const ps = applyMatrix(m, cx + r * Math.cos(a), cy + r * Math.sin(a));
            pts.push(svgToWorldPt(ps.x, ps.y, unitScale));
          }
          objects.push({
            name: `Эллипс SVG ${objects.length + 1}`,
            type: 'polyline',
            points: pts,
            closed: true,
            depth: defaultDepth,
            operationType: 'cut',
            visible: true,
          });
        }
      }
    } else if (tag === 'ellipse') {
      const cx = numAttr(el, 'cx');
      const cy = numAttr(el, 'cy');
      const rx = numAttr(el, 'rx');
      const ry = numAttr(el, 'ry');
      if (rx > 0.01 && ry > 0.01) {
        const pts: Point2D[] = [];
        for (let k = 0; k < 36; k++) {
          const a = (k * Math.PI * 2) / 36;
          const ps = applyMatrix(m, cx + rx * Math.cos(a), cy + ry * Math.sin(a));
          pts.push(svgToWorldPt(ps.x, ps.y, unitScale));
        }
        objects.push({
          name: `Эллипс SVG ${objects.length + 1}`,
          type: 'polyline',
          points: pts,
          closed: true,
          depth: defaultDepth,
          operationType: 'cut',
          visible: true,
        });
      }
    } else if (tag === 'polyline' || tag === 'polygon') {
      const rawPts = (getAttr(el, 'points') ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(Number.isFinite);
      const pts: Point2D[] = [];
      for (let idx = 0; idx + 1 < rawPts.length; idx += 2) {
        const ps = applyMatrix(m, rawPts[idx], rawPts[idx + 1]);
        pts.push(svgToWorldPt(ps.x, ps.y, unitScale));
      }
      if (pts.length >= 2) {
        objects.push({
          name: `${tag === 'polygon' ? 'Контур' : 'Полилиния'} SVG ${objects.length + 1}`,
          type: 'polyline',
          points: pts,
          closed: tag === 'polygon',
          depth: defaultDepth,
          operationType: 'cut',
          visible: true,
        });
      }
    } else if (tag === 'path') {
      const d = getAttr(el, 'd') ?? '';
      const subpaths = svgPathToSubpaths(d);
      for (const sp of subpaths) {
        const worldPts = sp.pts.map((p) => {
          const ps = applyMatrix(m, p.x, p.y);
          return svgToWorldPt(ps.x, ps.y, unitScale);
        });
        if (worldPts.length === 2 && !sp.closed) {
          objects.push({
            name: `Отрезок SVG ${objects.length + 1}`,
            type: 'line',
            startX: worldPts[0].x,
            startY: worldPts[0].y,
            endX: worldPts[1].x,
            endY: worldPts[1].y,
            depth: defaultDepth,
            operationType: 'cut',
            visible: true,
          });
        } else if (worldPts.length >= 2) {
          objects.push({
            name: `${sp.closed ? 'Контур' : 'Кривая'} SVG ${objects.length + 1}`,
            type: 'polyline',
            points: worldPts,
            closed: sp.closed,
            depth: defaultDepth,
            operationType: 'cut',
            visible: true,
          });
        }
      }
    }

    for (const child of el.children) {
      walk(child, m);
    }
  };

  walk(svgEl, IDENTITY);

  if (objects.length === 0) {
    warnings.push('В SVG-файле не найдено векторных фигур (<path>, <line>, <rect>, <circle>, <polyline>).');
  }

  const { counts, rawBounds } = summarizeObjects(objects);
  return {
    objects,
    rawBounds,
    counts,
    warnings,
    sourceFormat: 'svg',
    detectedUnitNote,
    suggestedScale: 1,
  };
}

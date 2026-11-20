import {
  ArcObject,
  CADObject,
  NewCADObjectInput,
  Point2D,
  TrimPreviewState,
} from '../../types';
import { roundedRectangleOutline } from './transform';

const TAU = Math.PI * 2;
const EPS = 1e-4;

function normAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}

/**
 * Угловой охват дуги в [0, 2π] (в направлении движения от start до end).
 */
export function getArcSweepSpan(
  arc: Pick<ArcObject, 'startX' | 'startY' | 'endX' | 'endY' | 'centerX' | 'centerY' | 'clockwise'>
): {
  a0: number;
  span: number;
} {
  const a0 = normAngle(Math.atan2(arc.startY - arc.centerY, arc.startX - arc.centerX));
  const a1 = normAngle(Math.atan2(arc.endY - arc.centerY, arc.endX - arc.centerX));
  let span = arc.clockwise ? normAngle(a0 - a1) : normAngle(a1 - a0);
  if (span < 1e-6) span = TAU;
  return { a0, span };
}

/**
 * Положение точки p вдоль дуги как параметр u ∈ [0, span], или null если точка вне сектора.
 */
function pointParamOnArc(arc: ArcObject, p: Point2D, epsAngle = 1e-3): number | null {
  const { a0, span } = getArcSweepSpan(arc);
  const ang = normAngle(Math.atan2(p.y - arc.centerY, p.x - arc.centerX));
  const u = arc.clockwise ? normAngle(a0 - ang) : normAngle(ang - a0);
  if (u <= span + epsAngle) return Math.min(span, Math.max(0, u));
  if (TAU - u <= epsAngle) return 0;
  return null;
}

// ---------------------------------------------------------------------------
// Пересечения примитивов (для инструмента «Ножницы»)
// ---------------------------------------------------------------------------

interface Segment2D {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

function intersectSegmentSegment(s1: Segment2D, s2: Segment2D): Point2D[] {
  const rdx = s1.bx - s1.ax;
  const rdy = s1.by - s1.ay;
  const sdx = s2.bx - s2.ax;
  const sdy = s2.by - s2.ay;
  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < 1e-9) return [];

  const qpx = s2.ax - s1.ax;
  const qpy = s2.ay - s1.ay;
  const t = (qpx * sdy - qpy * sdx) / denom;
  const u = (qpx * rdy - qpy * rdx) / denom;
  if (t >= -1e-5 && t <= 1 + 1e-5 && u >= -1e-5 && u <= 1 + 1e-5) {
    const tc = Math.min(1, Math.max(0, t));
    return [{ x: s1.ax + tc * rdx, y: s1.ay + tc * rdy }];
  }
  return [];
}

function intersectSegmentCircle(s: Segment2D, cx: number, cy: number, r: number): Point2D[] {
  if (r <= EPS) return [];
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const fx = s.ax - cx;
  const fy = s.ay - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < -1e-6) return [];
  disc = Math.max(0, disc);
  const sqrtD = Math.sqrt(disc);
  const out: Point2D[] = [];
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  for (const t of [t1, t2]) {
    if (t >= -1e-5 && t <= 1 + 1e-5) {
      const tc = Math.min(1, Math.max(0, t));
      const pt = { x: s.ax + tc * dx, y: s.ay + tc * dy };
      if (!out.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 1e-3)) {
        out.push(pt);
      }
    }
  }
  return out;
}

function intersectCircleCircle(
  c1x: number,
  c1y: number,
  r1: number,
  c2x: number,
  c2y: number,
  r2: number
): Point2D[] {
  const dx = c2x - c1x;
  const dy = c2y - c1y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6 || d > r1 + r2 + 1e-4 || d < Math.abs(r1 - r2) - 1e-4) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = Math.max(0, r1 * r1 - a * a);
  const h = Math.sqrt(hSq);
  const xm = c1x + (a * dx) / d;
  const ym = c1y + (a * dy) / d;
  if (h < 1e-4) return [{ x: xm, y: ym }];
  const rx = (-dy * h) / d;
  const ry = (dx * h) / d;
  return [
    { x: xm + rx, y: ym + ry },
    { x: xm - rx, y: ym - ry },
  ];
}

function objectAsSegments(obj: CADObject): Segment2D[] {
  if (obj.type === 'line') {
    return [{ ax: obj.startX, ay: obj.startY, bx: obj.endX, by: obj.endY }];
  }
  if (obj.type === 'polyline' && obj.points.length >= 2) {
    const segs: Segment2D[] = [];
    const n = obj.closed ? obj.points.length : obj.points.length - 1;
    for (let i = 0; i < n; i++) {
      const p1 = obj.points[i];
      const p2 = obj.points[(i + 1) % obj.points.length];
      segs.push({ ax: p1.x, ay: p1.y, bx: p2.x, by: p2.y });
    }
    return segs;
  }
  if (obj.type === 'rectangle') {
    const pts = roundedRectangleOutline(obj, 8);
    const segs: Segment2D[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      segs.push({ ax: p1.x, ay: p1.y, bx: p2.x, by: p2.y });
    }
    return segs;
  }
  return [];
}

function findObjectIntersectionsWith(target: CADObject, other: CADObject): Point2D[] {
  if (other.id === target.id || other.visible === false || other.type === 'point') return [];

  if (target.type === 'line') {
    const sTarget: Segment2D = {
      ax: target.startX,
      ay: target.startY,
      bx: target.endX,
      by: target.endY,
    };
    if (other.type === 'circle') {
      return intersectSegmentCircle(sTarget, other.centerX, other.centerY, other.radius);
    }
    if (other.type === 'arc') {
      return intersectSegmentCircle(sTarget, other.centerX, other.centerY, other.radius).filter(
        (pt) => pointParamOnArc(other, pt) !== null
      );
    }
    const pts: Point2D[] = [];
    for (const seg of objectAsSegments(other)) {
      pts.push(...intersectSegmentSegment(sTarget, seg));
    }
    return pts;
  }

  if (target.type === 'arc' || target.type === 'circle') {
    const cx = target.centerX;
    const cy = target.centerY;
    const r = target.radius;
    const rawPts: Point2D[] = [];
    if (other.type === 'circle') {
      rawPts.push(...intersectCircleCircle(cx, cy, r, other.centerX, other.centerY, other.radius));
    } else if (other.type === 'arc') {
      rawPts.push(
        ...intersectCircleCircle(cx, cy, r, other.centerX, other.centerY, other.radius).filter(
          (pt) => pointParamOnArc(other, pt) !== null
        )
      );
    } else {
      for (const seg of objectAsSegments(other)) {
        rawPts.push(...intersectSegmentCircle(seg, cx, cy, r));
      }
    }
    if (target.type === 'arc') {
      return rawPts.filter((pt) => pointParamOnArc(target, pt) !== null);
    }
    return rawPts;
  }

  return [];
}

export interface TrimOperationResult {
  preview: TrimPreviewState;
  replacements: NewCADObjectInput[];
}

/**
 * Вычисляет результат обрезки («Ножницы») для отрезка, дуги или окружности
 * в точке worldPt относительно всех пересечений с видимыми фигурами.
 */
export function computeTrimOperation(
  target: CADObject,
  worldPt: Point2D,
  allObjects: CADObject[]
): TrimOperationResult | null {
  if (target.frozen) return null;

  const rawIntersections: Point2D[] = [];
  for (const other of allObjects) {
    rawIntersections.push(...findObjectIntersectionsWith(target, other));
  }

  // Дедупликация пересечений
  const uniquePts: Point2D[] = [];
  for (const p of rawIntersections) {
    if (!uniquePts.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 0.05)) {
      uniquePts.push(p);
    }
  }

  if (target.type === 'line') {
    const dx = target.endX - target.startX;
    const dy = target.endY - target.startY;
    const lenSq = dx * dx + dy * dy;
    const len = Math.sqrt(lenSq);
    if (len < 0.1) return null;

    const minParam = 0.05 / len;
    const maxParam = 1 - minParam;

    const ts: number[] = [];
    for (const p of uniquePts) {
      const t = ((p.x - target.startX) * dx + (p.y - target.startY) * dy) / lenSq;
      if (t > minParam && t < maxParam && !ts.some((v) => Math.abs(v - t) * len < 0.05)) {
        ts.push(t);
      }
    }
    if (ts.length === 0) return null;
    ts.sort((a, b) => a - b);

    const breaks = [0, ...ts, 1];
    const tMouse = Math.min(
      1,
      Math.max(0, ((worldPt.x - target.startX) * dx + (worldPt.y - target.startY) * dy) / lenSq)
    );

    let segIdx = 0;
    for (let i = 0; i < breaks.length - 1; i++) {
      if (tMouse >= breaks[i] - 1e-6 && tMouse <= breaks[i + 1] + 1e-6) {
        segIdx = i;
        break;
      }
    }

    const bStart = breaks[segIdx];
    const bEnd = breaks[segIdx + 1];
    const ptAt = (t: number): Point2D => ({
      x: target.startX + t * dx,
      y: target.startY + t * dy,
    });

    const cutPoints: Point2D[] = [];
    if (segIdx > 0) cutPoints.push(ptAt(bStart));
    if (segIdx + 1 < breaks.length - 1) cutPoints.push(ptAt(bEnd));

    const replacements: NewCADObjectInput[] = [];
    if (bStart > minParam) {
      const p1 = ptAt(0);
      const p2 = ptAt(bStart);
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.1) {
        replacements.push({
          name: target.name,
          type: 'line',
          startX: p1.x,
          startY: p1.y,
          endX: p2.x,
          endY: p2.y,
          depth: target.depth,
          operationType: target.operationType,
          color: target.color,
          visible: target.visible,
        });
      }
    }
    if (1 - bEnd > minParam) {
      const p1 = ptAt(bEnd);
      const p2 = ptAt(1);
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.1) {
        replacements.push({
          name: replacements.length === 0 ? target.name : `${target.name} (ч.2)`,
          type: 'line',
          startX: p1.x,
          startY: p1.y,
          endX: p2.x,
          endY: p2.y,
          depth: target.depth,
          operationType: target.operationType,
          color: target.color,
          visible: target.visible,
        });
      }
    }

    return {
      preview: {
        objectId: target.id,
        cutPoints,
        removeSegment: {
          kind: 'line',
          start: ptAt(bStart),
          end: ptAt(bEnd),
        },
      },
      replacements,
    };
  }

  if (target.type === 'arc') {
    const { a0, span } = getArcSweepSpan(target);
    const r = target.radius;
    if (r < 0.1) return null;

    const minU = 0.05 / r;
    const us: number[] = [];
    for (const p of uniquePts) {
      const u = pointParamOnArc(target, p, 1e-3);
      if (u !== null && u > minU && u < span - minU && !us.some((v) => Math.abs(v - u) * r < 0.05)) {
        us.push(u);
      }
    }
    if (us.length === 0) return null;
    us.sort((a, b) => a - b);

    const breaks = [0, ...us, span];
    const angMouse = normAngle(Math.atan2(worldPt.y - target.centerY, worldPt.x - target.centerX));
    let uMouse = target.clockwise ? normAngle(a0 - angMouse) : normAngle(angMouse - a0);
    if (uMouse > span) {
      // Ближе к какому концу дуги
      const dToEnd = Math.abs(uMouse - span);
      const dToStart = Math.abs(TAU - uMouse);
      uMouse = dToEnd <= dToStart ? span : 0;
    }

    let segIdx = 0;
    for (let i = 0; i < breaks.length - 1; i++) {
      if (uMouse >= breaks[i] - 1e-6 && uMouse <= breaks[i + 1] + 1e-6) {
        segIdx = i;
        break;
      }
    }

    const angleAt = (u: number) => (target.clockwise ? a0 - u : a0 + u);
    const ptAt = (u: number): Point2D => {
      const ang = angleAt(u);
      return {
        x: target.centerX + r * Math.cos(ang),
        y: target.centerY + r * Math.sin(ang),
      };
    };

    const bStart = breaks[segIdx];
    const bEnd = breaks[segIdx + 1];
    const cutPoints: Point2D[] = [];
    if (segIdx > 0) cutPoints.push(ptAt(bStart));
    if (segIdx + 1 < breaks.length - 1) cutPoints.push(ptAt(bEnd));

    const replacements: NewCADObjectInput[] = [];
    if (bStart > minU) {
      const sPt = ptAt(0);
      const ePt = ptAt(bStart);
      replacements.push({
        name: target.name,
        type: 'arc',
        startX: sPt.x,
        startY: sPt.y,
        endX: ePt.x,
        endY: ePt.y,
        centerX: target.centerX,
        centerY: target.centerY,
        radius: r,
        clockwise: target.clockwise,
        depth: target.depth,
        operationType: target.operationType,
        color: target.color,
        visible: target.visible,
      });
    }
    if (span - bEnd > minU) {
      const sPt = ptAt(bEnd);
      const ePt = ptAt(span);
      replacements.push({
        name: replacements.length === 0 ? target.name : `${target.name} (ч.2)`,
        type: 'arc',
        startX: sPt.x,
        startY: sPt.y,
        endX: ePt.x,
        endY: ePt.y,
        centerX: target.centerX,
        centerY: target.centerY,
        radius: r,
        clockwise: target.clockwise,
        depth: target.depth,
        operationType: target.operationType,
        color: target.color,
        visible: target.visible,
      });
    }

    return {
      preview: {
        objectId: target.id,
        cutPoints,
        removeSegment: {
          kind: 'arc',
          center: { x: target.centerX, y: target.centerY },
          radius: r,
          startAngle: angleAt(bStart),
          endAngle: angleAt(bEnd),
          clockwise: target.clockwise,
        },
      },
      replacements,
    };
  }

  if (target.type === 'circle') {
    const r = target.radius;
    if (r < 0.1 || uniquePts.length < 2) return null;

    const angles: number[] = [];
    for (const p of uniquePts) {
      const a = normAngle(Math.atan2(p.y - target.centerY, p.x - target.centerX));
      if (!angles.some((v) => Math.abs(v - a) * r < 0.05 || (TAU - Math.abs(v - a)) * r < 0.05)) {
        angles.push(a);
      }
    }
    if (angles.length < 2) return null;
    angles.sort((a, b) => a - b);

    const aMouse = normAngle(Math.atan2(worldPt.y - target.centerY, worldPt.x - target.centerX));
    let segIdx = angles.length - 1;
    for (let i = 0; i < angles.length - 1; i++) {
      if (aMouse >= angles[i] && aMouse <= angles[i + 1]) {
        segIdx = i;
        break;
      }
    }
    const cutStart = angles[segIdx];
    const cutEnd = angles[(segIdx + 1) % angles.length];
    const ptAt = (a: number): Point2D => ({
      x: target.centerX + r * Math.cos(a),
      y: target.centerY + r * Math.sin(a),
    });

    // Оставшаяся дуга идёт против ч/с от cutEnd до cutStart
    const keepStart = ptAt(cutEnd);
    const keepEnd = ptAt(cutStart);
    const arcObj: NewCADObjectInput = {
      name: `Дуга R${r.toFixed(1)}`,
      type: 'arc',
      startX: keepStart.x,
      startY: keepStart.y,
      endX: keepEnd.x,
      endY: keepEnd.y,
      centerX: target.centerX,
      centerY: target.centerY,
      radius: r,
      clockwise: false,
      depth: target.depth,
      operationType: target.operationType,
      color: target.color,
      visible: target.visible,
    };

    return {
      preview: {
        objectId: target.id,
        cutPoints: [ptAt(cutStart), ptAt(cutEnd)],
        removeSegment: {
          kind: 'arc',
          center: { x: target.centerX, y: target.centerY },
          radius: r,
          startAngle: cutStart,
          endAngle: cutEnd,
          clockwise: false,
        },
      },
      replacements: [arcObj],
    };
  }

  return null;
}

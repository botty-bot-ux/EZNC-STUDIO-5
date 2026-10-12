import { CADObject, Point2D } from '../../types';
import { DragMode, HandleType } from './canvasHitTest';
import { constrainAngle } from '../../lib/geometry/transform';

/** Point at distance `len` from `origin` along angle `ang` (radians). */
export function pointFromPolar(origin: Point2D, ang: number, len: number): Point2D {
  return { x: origin.x + len * Math.cos(ang), y: origin.y + len * Math.sin(ang) };
}

/** Не выпускать точку за грани +X (x=0) и +Y (y=0) заготовки (лист лежит в x<=0, y<=0). */
export function clampToPosFaces(pt: Point2D): Point2D {
  return { x: Math.min(pt.x, 0), y: Math.min(pt.y, 0) };
}

/**
 * Если конец отрезка/хорды ушёл за грани +X/+Y, укоротить луч anchor→end до
 * пересечения с ближайшей гранью — отрезок «упирается» в неё.
 */
export function clampRayToPosFaces(anchor: Point2D, end: Point2D): Point2D {
  const dx = end.x - anchor.x;
  const dy = end.y - anchor.y;
  let t = 1;
  if (end.x > 0 && dx > 1e-9) t = Math.min(t, Math.max(0, -anchor.x / dx));
  if (end.y > 0 && dy > 1e-9) t = Math.min(t, Math.max(0, -anchor.y / dy));
  if (t >= 1) return end;
  return { x: anchor.x + dx * t, y: anchor.y + dy * t };
}

export function shiftCADObject(obj: CADObject, dx: number, dy: number): Partial<CADObject> {
  if (obj.type === 'point') {
    return { x: obj.x + dx, y: obj.y + dy };
  }
  if (obj.type === 'line') {
    return {
      startX: obj.startX + dx,
      startY: obj.startY + dy,
      endX: obj.endX + dx,
      endY: obj.endY + dy,
    };
  }
  if (obj.type === 'rectangle') {
    return { x: obj.x + dx, y: obj.y + dy };
  }
  if (obj.type === 'circle') {
    return { centerX: obj.centerX + dx, centerY: obj.centerY + dy };
  }
  if (obj.type === 'arc') {
    return {
      startX: obj.startX + dx,
      startY: obj.startY + dy,
      endX: obj.endX + dx,
      endY: obj.endY + dy,
      centerX: obj.centerX + dx,
      centerY: obj.centerY + dy,
    };
  }
  if (obj.type === 'polyline' && obj.points) {
    return {
      points: obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
  return {};
}

export function translateObjectFull(obj: CADObject, dx: number, dy: number): CADObject {
  return { ...obj, ...shiftCADObject(obj, dx, dy) } as CADObject;
}

/**
 * Вычисляет патчи для группового редактирования узла (перетаскивание грифа).
 * Чистая геометрия: возвращает массив { id, patch } для всех фигур выделения,
 * у которых соответствующий узел совпадает со схваченным якорем (в пределах
 * порога захвата). Возвращает null, если схваченный режим драга не является
 * узловым (нет anchorOriginal) — вызывающий тогда ничего не коммитит.
 */
export function computeNodeEditItems(params: {
  objects: CADObject[];
  dragIds: string[];
  base: CADObject;
  dragMode: DragMode;
  snapPt: Point2D;
  shift: boolean;
  ctrl: boolean;
  zoom: number;
}): Array<{ id: string; patch: Partial<CADObject> }> | null {
  const { objects, dragIds, base, dragMode, snapPt, shift, ctrl, zoom } = params;

  // Мировая точка схваченного грифа на якоре ДО начала драга — относительно неё
  // считаем смещение, которое применим ко всем «совпадающим» узлам группы.
  let anchorOriginal: Point2D | null = null;
  if (base.type === 'line' && (dragMode === 'line_start' || dragMode === 'line_end')) {
    anchorOriginal =
      dragMode === 'line_start'
        ? { x: base.startX, y: base.startY }
        : { x: base.endX, y: base.endY };
  } else if (base.type === 'arc') {
    if (dragMode === 'arc_start') anchorOriginal = { x: base.startX, y: base.startY };
    else if (dragMode === 'arc_end') anchorOriginal = { x: base.endX, y: base.endY };
    else if (dragMode === 'arc_center') anchorOriginal = { x: base.centerX, y: base.centerY };
  }

  if (!anchorOriginal) return null;

  // Целевая точка якоря = snap + ограничения Shift/Ctrl (для концов линии) + «стенка».
  let target: Point2D = snapPt;
  if (base.type === 'line' && (dragMode === 'line_start' || dragMode === 'line_end') && (shift || ctrl)) {
    const pivot =
      dragMode === 'line_start'
        ? { x: base.endX, y: base.endY }
        : { x: base.startX, y: base.startY };
    target = constrainAngle(pivot, snapPt, shift ? 45 : 90);
  }
  target = clampToPosFaces(target);
  const dx = target.x - anchorOriginal.x;
  const dy = target.y - anchorOriginal.y;

  // Порог «тот же самый узел»: радиус захвата грифа, пересчитанный в мм.
  const tol = 14 / zoom;
  const isCenterDrag = dragMode === 'arc_center';
  const idset = new Set(dragIds);
  const items: Array<{ id: string; patch: Partial<CADObject> }> = [];

  for (const o of objects) {
    if (!idset.has(o.id)) continue;
    let patch: Partial<CADObject> | null = null;

    if (isCenterDrag) {
      // arc_center: тянем только те дуги, чей центр совпадает с якорем.
      if (
        o.type === 'arc' &&
        Math.hypot(o.centerX - anchorOriginal.x, o.centerY - anchorOriginal.y) <= tol
      ) {
        patch = {
          centerX: o.centerX + dx,
          centerY: o.centerY + dy,
          startX: o.startX + dx,
          startY: o.startY + dy,
          endX: o.endX + dx,
          endY: o.endY + dy,
        };
      }
    } else {
      // «Концевой» перетяг: у каждой фигуры берём тот конец (start/line или arc),
      // который ближе всего к схваченному узлу якоря и находится в пределах tol.
      const cand: Array<{ type: HandleType; x: number; y: number }> = [];
      if (o.type === 'line') {
        cand.push({ type: 'line_start', x: o.startX, y: o.startY });
        cand.push({ type: 'line_end', x: o.endX, y: o.endY });
      } else if (o.type === 'arc') {
        cand.push({ type: 'arc_start', x: o.startX, y: o.startY });
        cand.push({ type: 'arc_end', x: o.endX, y: o.endY });
      }
      let chosen: { type: HandleType; x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const c of cand) {
        const d = Math.hypot(c.x - anchorOriginal.x, c.y - anchorOriginal.y);
        if (d <= tol && d < bestD) {
          bestD = d;
          chosen = c;
        }
      }
      if (chosen) {
        const nx = chosen.x + dx;
        const ny = chosen.y + dy;
        if (chosen.type === 'line_start') patch = { startX: nx, startY: ny };
        else if (chosen.type === 'line_end') patch = { endX: nx, endY: ny };
        else if (chosen.type === 'arc_start' && o.type === 'arc') {
          // Тянем за НАЧАЛО дуги: центр фиксирован, радиус = расстояние до курсора.
          // Второй конец НЕ оставляем на месте — он уезжает вдоль своего направления,
          // чтобы всегда лежать на окружности (в конце дуги), а не отдельно от неё.
          const cx = o.centerX;
          const cy = o.centerY;
          const newR = Math.hypot(nx - cx, ny - cy);
          const ux = o.endX - cx;
          const uy = o.endY - cy;
          const ul = Math.hypot(ux, uy) || 1;
          patch = {
            startX: nx,
            startY: ny,
            radius: newR,
            endX: cx + (ux / ul) * newR,
            endY: cy + (uy / ul) * newR,
          };
        } else if (chosen.type === 'arc_end' && o.type === 'arc') {
          // То же для КОНЦА дуги: начало уезжает вдоль своего радиуса на новую окружность.
          const cx = o.centerX;
          const cy = o.centerY;
          const newR = Math.hypot(nx - cx, ny - cy);
          const ux = o.startX - cx;
          const uy = o.startY - cy;
          const ul = Math.hypot(ux, uy) || 1;
          patch = {
            endX: nx,
            endY: ny,
            radius: newR,
            startX: cx + (ux / ul) * newR,
            startY: cy + (uy / ul) * newR,
          };
        }
      }
    }
    if (patch) items.push({ id: o.id, patch });
  }

  return items;
}

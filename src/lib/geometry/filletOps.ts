import {
  ArcObject,
  FilletPreviewState,
  LineObject,
  Point2D,
} from '../../types';

// ---------------------------------------------------------------------------
// Скругление угла между двумя отрезками (Fillet)
// ---------------------------------------------------------------------------

export interface TwoLineFilletResult {
  lineA: Partial<LineObject>;
  lineB: Partial<LineObject>;
  arc: Omit<ArcObject, 'id' | 'name' | 'depth' | 'operationType' | 'type'>;
  preview: FilletPreviewState;
}

export type TwoLineFilletOutcome =
  | { ok: true; result: TwoLineFilletResult }
  | { ok: false; reason: string };

/**
 * Вычисляет касательную дугу радиуса radius между двумя непараллельными отрезками l1 и l2
 * и новые подрезанные/продлённые концы обоих отрезков.
 */
export function computeTwoLineFillet(
  l1: LineObject,
  l2: LineObject,
  radius: number,
  click1?: Point2D,
  click2?: Point2D
): TwoLineFilletOutcome {
  if (!(radius > 0.05)) {
    return { ok: false, reason: 'Укажите положительный радиус скругления' };
  }

  const d1x = l1.endX - l1.startX;
  const d1y = l1.endY - l1.startY;
  const len1 = Math.hypot(d1x, d1y);
  const d2x = l2.endX - l2.startX;
  const d2y = l2.endY - l2.startY;
  const len2 = Math.hypot(d2x, d2y);

  if (len1 < 0.1 || len2 < 0.1) {
    return { ok: false, reason: 'Вырожденный отрезок' };
  }

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-6 * len1 * len2) {
    return { ok: false, reason: 'Отрезки параллельны' };
  }

  // Точка пересечения прямых V
  const qpx = l2.startX - l1.startX;
  const qpy = l2.startY - l1.startY;
  const tInt = (qpx * d2y - qpy * d2x) / denom;
  const V: Point2D = {
    x: l1.startX + tInt * d1x,
    y: l1.startY + tInt * d1y,
  };

  // Выбираем для каждого отрезка тот конец, который ОСТАЁТСЯ (от вершины V к нему).
  const pickKeptEndpoint = (
    l: LineObject,
    clickPt?: Point2D
  ): { kept: Point2D; keepEnd: 'start' | 'end' } => {
    const pS = { x: l.startX, y: l.startY };
    const pE = { x: l.endX, y: l.endY };
    const dS = Math.hypot(pS.x - V.x, pS.y - V.y);
    const dE = Math.hypot(pE.x - V.x, pE.y - V.y);

    // Если один из концов почти совпадает с пересечением V — оставляем противоположный
    if (dS < 0.5 && dE >= 0.5) return { kept: pE, keepEnd: 'end' };
    if (dE < 0.5 && dS >= 0.5) return { kept: pS, keepEnd: 'start' };

    // Если пересечение внутри самого отрезка (X или T) и известна точка клика —
    // оставляем сторону, куда кликнул пользователь.
    const projV =
      ((V.x - pS.x) * (pE.x - pS.x) + (V.y - pS.y) * (pE.y - pS.y)) /
      Math.max(1e-9, (pE.x - pS.x) ** 2 + (pE.y - pS.y) ** 2);

    if (clickPt && projV > 0.01 && projV < 0.99) {
      const projClick =
        ((clickPt.x - pS.x) * (pE.x - pS.x) + (clickPt.y - pS.y) * (pE.y - pS.y)) /
        Math.max(1e-9, (pE.x - pS.x) ** 2 + (pE.y - pS.y) ** 2);
      return projClick >= projV
        ? { kept: pE, keepEnd: 'end' }
        : { kept: pS, keepEnd: 'start' };
    }

    // Если угол не соединён или нет клика — оставляем более длинный луч от V
    return dE >= dS ? { kept: pE, keepEnd: 'end' } : { kept: pS, keepEnd: 'start' };
  };

  const k1 = pickKeptEndpoint(l1, click1);
  const k2 = pickKeptEndpoint(l2, click2);

  const v1x = k1.kept.x - V.x;
  const v1y = k1.kept.y - V.y;
  const ray1Len = Math.hypot(v1x, v1y);
  const v2x = k2.kept.x - V.x;
  const v2y = k2.kept.y - V.y;
  const ray2Len = Math.hypot(v2x, v2y);

  if (ray1Len < 0.1 || ray2Len < 0.1) {
    return { ok: false, reason: 'Слишком короткий участок от пересечения' };
  }

  const u1 = { x: v1x / ray1Len, y: v1y / ray1Len };
  const u2 = { x: v2x / ray2Len, y: v2y / ray2Len };

  const dot = Math.min(1, Math.max(-1, u1.x * u2.x + u1.y * u2.y));
  const alpha = Math.acos(dot);
  if (alpha < 0.02 || alpha > Math.PI - 0.02) {
    return { ok: false, reason: 'Угол между линиями близок к 0° или 180°' };
  }

  const tanDist = radius / Math.tan(alpha / 2);
  if (tanDist > ray1Len + 0.01 || tanDist > ray2Len + 0.01) {
    const maxR = Math.min(ray1Len, ray2Len) * Math.tan(alpha / 2);
    return {
      ok: false,
      reason: `Радиус ${radius} мм велик для этого угла (макс. ~${maxR.toFixed(1)} мм)`,
    };
  }

  const T1: Point2D = { x: V.x + u1.x * tanDist, y: V.y + u1.y * tanDist };
  const T2: Point2D = { x: V.x + u2.x * tanDist, y: V.y + u2.y * tanDist };

  // Биссектриса угла между u1 и u2
  const bx = u1.x + u2.x;
  const by = u1.y + u2.y;
  const bLen = Math.hypot(bx, by);
  if (bLen < 1e-6) {
    return { ok: false, reason: 'Не удалось построить биссектрису' };
  }
  const distToCenter = radius / Math.sin(alpha / 2);
  const center: Point2D = {
    x: V.x + (bx / bLen) * distToCenter,
    y: V.y + (by / bLen) * distToCenter,
  };

  // Знак векторного произведения (T1 - C) × (T2 - C) определяет направление обхода дуги:
  // в мире XY cross < 0 соответствует движению по часовой стрелке (G02).
  const cross = (T1.x - center.x) * (T2.y - center.y) - (T1.y - center.y) * (T2.x - center.x);
  const clockwise = cross < 0;

  const lineA: Partial<LineObject> =
    k1.keepEnd === 'end'
      ? { startX: T1.x, startY: T1.y }
      : { endX: T1.x, endY: T1.y };

  const lineB: Partial<LineObject> =
    k2.keepEnd === 'end'
      ? { startX: T2.x, startY: T2.y }
      : { endX: T2.x, endY: T2.y };

  const arcData = {
    centerX: center.x,
    centerY: center.y,
    radius,
    startX: T1.x,
    startY: T1.y,
    endX: T2.x,
    endY: T2.y,
    clockwise,
  };

  return {
    ok: true,
    result: {
      lineA,
      lineB,
      arc: arcData,
      preview: {
        arc: arcData,
        tangent1: T1,
        tangent2: T2,
      },
    },
  };
}

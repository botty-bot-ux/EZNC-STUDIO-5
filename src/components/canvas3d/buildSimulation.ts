import * as THREE from 'three';
import { MachineSettings, ToolpathSegment } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Построитель геометрии 3D-симуляции съёма фрезой.
//
// Координаты: мир CAD — X вправо, Y «вверх», Z = -глубина (врезание вниз).
// three.js — Y-up, поэтому мировая глубина уходит в −Y сцены, а мировой Y → −Z.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Паз рисуем только там, где фреза реально снимает материал: горизонтальные
 * подачи/дуги со смещением по XY и сверловка (тип 'drill'). Чистые вертикальные
 * врезки (feed без движения по XY) паза не дают.
 */
export function isGroove(seg: ToolpathSegment): boolean {
  if (seg.type === 'drill') return true;
  if (seg.type === 'rapid') return false;
  if (seg.type === 'arc_cw' || seg.type === 'arc_ccw') return true;
  return Math.abs(seg.endX - seg.startX) > 0.01 || Math.abs(seg.endY - seg.startY) > 0.01;
}

export interface GroovePiece {
  matrix: THREE.Matrix4;
}

/**
 * Один шаг таймлайна фрезы — короткий отрезок пути (прямой или сегмент дуги).
 * Плотная разбивка нужна, чтобы дуги изгибались, а паз открывался постепенно.
 */
export interface SimulationStep {
  a: THREE.Vector3; // старт (в сцене)
  b: THREE.Vector3; // конец (в сцене)
  lenXY: number; // горизонтальная длина шага, мм (для постоянной скорости)
  cut: boolean; // true — снимает материал (рисуем паз); false — холостой ход/врезка
  objectId?: string; // слой для подсветки
}

export interface BuiltSimulation {
  steps: SimulationStep[];
  grooves: GroovePiece[]; // матрицы пазов — по одному на cut-шаг
  grooveStepIndex: number[]; // индекс шага для каждого паза (строго возрастает)
  board: { cx: number; cy: number; cz: number; w: number; h: number; d: number };
  span: number;
}

export function buildScene(
  segs: ToolpathSegment[],
  toolDiameter: number,
  machine: MachineSettings
): BuiltSimulation | null {
  if (segs.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = 0;
  for (const s of segs) {
    minX = Math.min(minX, s.startX, s.endX);
    maxX = Math.max(maxX, s.startX, s.endX);
    minY = Math.min(minY, s.startY, s.endY);
    maxY = Math.max(maxY, s.startY, s.endY);
    minZ = Math.min(minZ, s.startZ, s.endZ);
  }
  if (![minX, maxX, minY, maxY, minZ].every(Number.isFinite)) return null;

  // Толщина листа = «Глубина реза Z» (machine.cutDepth), но не тоньше самого
  // глубокого вреза (иначе паз торчал бы за дно) и не меньше заготовки-минимума.
  const cutDepth = machine.cutDepth ?? 0;
  const thickness = Math.max(cutDepth, Math.abs(minZ), 8);

  // Габарит листа ДСП = «Заготовка листа» (stockSheet). В мировых координатах лист
  // занимает X∈[−widthX,0], Y∈[−widthY,0] (так его рисует 2D), поэтому центр —
  // (−widthX/2, −widthY/2). Если лист выключен — подгоняем плиту под содержимое.
  const sheet = machine.stockSheet;
  const useSheet =
    !!sheet && sheet.enabled && sheet.preset !== 'none' && sheet.widthX > 0 && sheet.widthY > 0;
  let bw: number;
  let bd: number;
  let cxWorld: number;
  let czWorld: number;
  if (useSheet && sheet) {
    bw = sheet.widthX;
    bd = sheet.widthY;
    cxWorld = -sheet.widthX / 2;
    czWorld = -sheet.widthY / 2;
  } else {
    const margin = 40 + toolDiameter;
    bw = maxX - minX + margin * 2;
    bd = maxY - minY + margin * 2;
    cxWorld = (minX + maxX) / 2;
    czWorld = (minY + maxY) / 2;
  }

  const board = {
    cx: cxWorld,
    cy: -thickness / 2,
    cz: -czWorld,
    w: bw,
    h: thickness,
    d: bd,
  };

  const grooves: GroovePiece[] = [];
  const grooveStepIndex: number[] = [];
  const steps: SimulationStep[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();

  // Шаг выборки пути: чтобы соседние боксы пазов перекрывались и сливались в
  // непрерывный канал (особенно на дугах). Не мельче 2 мм и не крупнее 25 мм.
  const sampleStep = Math.max(2, Math.min(toolDiameter * 0.6, 25));
  const lip = 0.2; // минимальный выступ над поверхностью против z-fighting

  // Разбиваем сегмент на мировые точки вдоль РЕАЛЬНОЙ траектории (дуга — по дуге).
  const samplePoints = (s: ToolpathSegment): { x: number; y: number; z: number }[] => {
    const pts: { x: number; y: number; z: number }[] = [];
    const isArc = s.type === 'arc_cw' || s.type === 'arc_ccw';
    if (!isArc) {
      const len = Math.hypot(s.endX - s.startX, s.endY - s.startY);
      const n = Math.max(1, Math.ceil(len / sampleStep));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push({
          x: s.startX + (s.endX - s.startX) * t,
          y: s.startY + (s.endY - s.startY) * t,
          z: s.startZ + (s.endZ - s.startZ) * t,
        });
      }
      return pts;
    }
    const cx = s.centerX ?? (s.startX + s.endX) / 2;
    const cy = s.centerY ?? (s.startY + s.endY) / 2;
    const r = Math.hypot(s.startX - cx, s.startY - cy);
    const a0 = Math.atan2(s.startY - cy, s.startX - cx);
    const a1 = Math.atan2(s.endY - cy, s.endX - cx);
    const cw = s.type === 'arc_cw';
    let delta = a1 - a0;
    if (cw) {
      while (delta > 0) delta -= Math.PI * 2;
      if (Math.abs(delta) < 1e-9) delta = -Math.PI * 2; // полная окружность
    } else {
      while (delta < 0) delta += Math.PI * 2;
      if (Math.abs(delta) < 1e-9) delta = Math.PI * 2; // полная окружность
    }
    const n = Math.max(2, Math.ceil((Math.abs(delta) * r) / sampleStep));
    for (let i = 0; i <= n; i++) {
      const ang = a0 + delta * (i / n);
      pts.push({
        x: cx + r * Math.cos(ang),
        y: cy + r * Math.sin(ang),
        z: s.startZ + (s.endZ - s.startZ) * (i / n),
      });
    }
    return pts;
  };

  for (const s of segs) {
    const cut = isGroove(s);
    const pts = samplePoints(s);
    // Общая граница соседних шагов одного сегмента (b шага i == a шага i+1) держим
    // одним Vector3: несём конец прошлого шага как начало текущего.
    let carry: THREE.Vector3 | null = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const ax = p0.x;
      const ay = p0.z;
      const az = -p0.y;
      const bx = p1.x;
      const by = p1.z;
      const bz = -p1.y;
      const stepIndex = steps.length;
      const a = carry ?? new THREE.Vector3(ax, ay, az);
      const b = new THREE.Vector3(bx, by, bz);
      carry = b;
      steps.push({
        a,
        b,
        lenXY: Math.hypot(p1.x - p0.x, p1.y - p0.y),
        cut,
        objectId: s.objectId,
      });

      if (!cut) continue;

      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      // Глубина паза не больше толщины листа: сквозной рез заполняет всю толщу,
      // но не торчит за нижнюю грань заготовки.
      const depth = Math.min(Math.max(Math.abs(p1.z), 0.2), thickness);

      let angleY = 0;
      let length = len;
      if (len < 0.01) {
        length = toolDiameter; // сверловка / врезка — пятно фрезы
      } else {
        angleY = Math.atan2(dx, dz);
      }

      q.setFromAxisAngle(up, angleY);
      pos.set((ax + bx) / 2, (lip - depth) / 2, (az + bz) / 2);
      scl.set(toolDiameter, depth + lip, length);
      m.compose(pos, q, scl);
      grooves.push({ matrix: m.clone() });
      grooveStepIndex.push(stepIndex);
    }
  }

  const span = Math.max(bw, bd);
  return { steps, grooves, grooveStepIndex, board, span };
}

/**
 * Верхняя граница: сколько пазов уже прорезано, если текущий шаг = currentStep.
 */
export function revealedCount(grooveStepIndex: number[], currentStep: number): number {
  let lo = 0;
  let hi = grooveStepIndex.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (grooveStepIndex[mid] <= currentStep) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Линии сетки по границам станка: минор каждые `step`, мажор каждые 5·step.
 * Мир CAD (x,y) → сцена (x, floorY, −y). major=true → только мажорные линии.
 */
export function buildGridLines(
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  step: number,
  floorY: number,
  major: boolean
): Float32Array {
  const pts: number[] = [];
  let i = 0;
  for (let wx = Math.ceil(xMin / step) * step; wx <= xMax + 1e-6; wx += step, i++) {
    if ((i % 5 === 0) !== major) continue;
    pts.push(wx, floorY, -yMin, wx, floorY, -yMax);
  }
  i = 0;
  for (let wy = Math.ceil(yMin / step) * step; wy <= yMax + 1e-6; wy += step, i++) {
    if ((i % 5 === 0) !== major) continue;
    pts.push(xMin, floorY, -wy, xMax, floorY, -wy);
  }
  return new Float32Array(pts);
}

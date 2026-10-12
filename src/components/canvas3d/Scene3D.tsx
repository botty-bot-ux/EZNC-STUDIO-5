import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';
import { MachineSettings, ToolpathSegment } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Симуляция съёма фрезой в 3D.
//
// Чистый ПОТРЕБИТЕЛЬ состояния: читает toolpathSegments (уже Z-aware из
// генератора G-кода) и machine.toolDiameter (ширина паза = диаметр фрезы).
// Ничего не пишет в стор, не создаёт вторую логику правки геометрии.
//
// Координаты: мир CAD — X вправо, Y «вверх», Z = -глубина (врезание вниз).
// three.js — Y-up, поэтому мировая глубина уходит в −Y сцены, а мировой Y → −Z.
// ─────────────────────────────────────────────────────────────────────────────

const toScene = (x: number, y: number, z: number): [number, number, number] => [x, z, -y];

// Паз рисуем только там, где фреза реально снимает материал: горизонтальные
// подачи/дуги с смещением по XY и сверловка (тип 'drill'). Чистые вертикальные
// plunges (feed без движения по XY) — это врезка в одной точке, паза не дают.
function isGroove(seg: ToolpathSegment): boolean {
  const moved = Math.abs(seg.endX - seg.startX) > 0.01 || Math.abs(seg.endY - seg.startY) > 0.01;
  if (seg.type === 'drill') return true;
  if (seg.type === 'rapid') return false;
  return moved;
}

interface GroovePiece {
  matrix: THREE.Matrix4;
}

// Один шаг таймлайна фрезы — короткий отрезок пути (прямой или сегмент дуги).
// Плотная разбивка нужна, чтобы дуги изгибались, а паз открывался постепенно.
interface Step {
  a: THREE.Vector3; // старт (в сцене)
  b: THREE.Vector3; // конец (в сцене)
  lenXY: number; // горизонтальная длина шага, мм (для постоянной скорости)
  cut: boolean; // true — снимает материал (рисуем паз); false — холостой ход/врезка
  objectId?: string; // слой для подсветки
}

interface Built {
  steps: Step[];
  grooves: GroovePiece[]; // матрицы пазов — по одному на cut-шаг
  grooveStepIndex: number[]; // индекс шага для каждого паза (строго возрастает)
  board: { cx: number; cy: number; cz: number; w: number; h: number; d: number };
  span: number;
}

function buildScene(segs: ToolpathSegment[], toolDiameter: number, machine: MachineSettings): Built | null {
  if (segs.length === 0) return null;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = 0;
  for (const s of segs) {
    minX = Math.min(minX, s.startX, s.endX);
    maxX = Math.max(maxX, s.startX, s.endX);
    minY = Math.min(minY, s.startY, s.endY);
    maxY = Math.max(maxY, s.startY, s.endY);
    minZ = Math.min(minZ, s.startZ, s.endZ);
  }
  if (!Number.isFinite(minX)) return null;

  // Толщина листа = «Глубина реза Z» (machine.cutDepth), но не тоньше самого
  // глубокого вреза (иначе паз торчал бы за дно) и не меньше заготовки-минимума.
  const cutDepth = machine.cutDepth ?? 0;
  const thickness = Math.max(cutDepth, Math.abs(minZ), 8);

  // Габарит листа ДСП = «Заготовка листа» (stockSheet). В мировых координатах лист
  // занимает X∈[−widthX,0], Y∈[−widthY,0] (так его рисует 2D), поэтому центр —
  // (−widthX/2, −widthY/2). Если лист выключен — подгоняем плиту под содержимое.
  const sheet = machine.stockSheet;
  const useSheet = !!sheet && sheet.enabled && sheet.preset !== 'none' && sheet.widthX > 0 && sheet.widthY > 0;
  let bw: number, bd: number, cxWorld: number, czWorld: number;
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
  const steps: Step[] = [];

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
      if (delta === 0) delta = -Math.PI * 2; // полная окружность
    } else {
      while (delta < 0) delta += Math.PI * 2;
      if (delta === 0) delta = Math.PI * 2;
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
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const [ax, ay, az] = toScene(p0.x, p0.y, p0.z);
      const [bx, by, bz] = toScene(p1.x, p1.y, p1.z);
      const stepIndex = steps.length;
      steps.push({
        a: new THREE.Vector3(ax, ay, az),
        b: new THREE.Vector3(bx, by, bz),
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

// Верхняя граница: сколько пазов уже прорезано, если текущий шаг = currentStep.
function revealedCount(grooveStepIndex: number[], currentStep: number): number {
  let lo = 0,
    hi = grooveStepIndex.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (grooveStepIndex[mid] <= currentStep) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface Clock {
  prog: number;
  playing: boolean;
  speed: number; // мм/с — постоянная скорость перемещения фрезы по XY
  done: boolean;
  total: number;
}

interface SceneContentsProps {
  built: Built | null;
  toolDiameter: number;
  clockRef: React.MutableRefObject<Clock>;
  onActiveLayer: (id: string | null) => void;
  labelRef: React.RefObject<HTMLSpanElement | null>;
  onDone: () => void;
}

const SceneContents: React.FC<SceneContentsProps> = ({ built, toolDiameter, clockRef, onActiveLayer, labelRef, onDone }) => {
  const instRef = React.useRef<THREE.InstancedMesh>(null);
  const cutterRef = React.useRef<THREE.Mesh>(null);
  const lastActiveIdRef = React.useRef<string | null>(null);

  // Разложить предрассчитанные матрицы пазов по буферу инстансов (один раз на построение).
  React.useLayoutEffect(() => {
    const mesh = instRef.current;
    if (!mesh || !built) return;
    built.grooves.forEach((g, i) => mesh.setMatrixAt(i, g.matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
    clockRef.current.total = built.steps.length;
    clockRef.current.prog = 0;
    clockRef.current.done = false;
    lastActiveIdRef.current = null;
    onActiveLayer(null);
  }, [built, clockRef, onActiveLayer]);

  useFrame((_, delta) => {
    const clock = clockRef.current;
    if (!built || built.steps.length === 0) return;
    const mesh = instRef.current;
    const total = built.steps.length;

    if (clock.playing && !clock.done) {
      // Постоянная скорость фрезы по XY; холостые ходы/врезки идут быстрее (×6),
      // чтобы перелёты не ползли. Короткие шаги считаем за минимум, чтобы не вставали.
      const cur = built.steps[Math.min(Math.floor(clock.prog), total - 1)];
      const eff = Math.max(cur.lenXY, 20);
      const mul = cur.cut ? 1 : 6;
      clock.prog += (delta * clock.speed * mul) / eff;
      if (clock.prog >= total) {
        clock.prog = total;
        clock.done = true;
        clock.playing = false;
        onDone();
      }
    }

    const currentStep = Math.min(Math.floor(clock.prog), total - 1);
    if (mesh) {
      const reveal = revealedCount(built.grooveStepIndex, clock.prog > 0 ? currentStep : -1);
      if (mesh.count !== reveal) mesh.count = reveal;
    }

    // Подпись прогресса обновляем прямо из useFrame — один владелец цикла анимации.
    if (labelRef.current) {
      labelRef.current.textContent = `${Math.min(Math.floor(clock.prog), total)} / ${total}`;
    }

    // Активный слой = фигура текущего шага; пишем в стор только при смене.
    const activeId = clock.prog > 0 ? built.steps[currentStep].objectId ?? null : null;
    if (activeId !== lastActiveIdRef.current) {
      lastActiveIdRef.current = activeId;
      onActiveLayer(activeId);
    }

    // Фреза: интерполяция внутри текущего шага.
    const cutter = cutterRef.current;
    if (cutter) {
      const t = Math.max(0, Math.min(1, clock.prog - currentStep));
      const seg = built.steps[currentStep];
      const tipY = THREE.MathUtils.lerp(seg.a.y, seg.b.y, t);
      const cutterH = 60;
      cutter.position.set(
        THREE.MathUtils.lerp(seg.a.x, seg.b.x, t),
        tipY + cutterH / 2,
        THREE.MathUtils.lerp(seg.a.z, seg.b.z, t)
      );
      const spinning = clock.playing && !clock.done;
      cutter.rotation.y += delta * (spinning ? 12 : 0);
    }
  });

  const maxCount = Math.max(built?.grooves.length ?? 0, 1);

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3000, 5000, 2000]} intensity={1.1} />
      <directionalLight position={[-2000, 3000, -1500]} intensity={0.4} />

      {/* Заготовка (плита ДСП) */}
      {built && (
        <mesh position={[built.board.cx, built.board.cy, built.board.cz]}>
          <boxGeometry args={[built.board.w, built.board.h, built.board.d]} />
          <meshStandardMaterial color="#d8b985" roughness={0.9} metalness={0.02} />
        </mesh>
      )}

      {/* Призрак всей траектории (то, что предстоит прорезать) */}
      {built && <GhostPath built={built} />}

      {/* Прорезанные пазы (instanced — обновляется только mesh.count, без ре-рендера) */}
      {built && built.grooves.length > 0 && (
        <instancedMesh key={maxCount} ref={instRef} args={[undefined, undefined, maxCount]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#5b3a1a" roughness={1} metalness={0} />
        </instancedMesh>
      )}

      {/* Фреза (всегда видна на текущей позиции, крутится только при съёме) */}
      <mesh ref={cutterRef}>
        <cylinderGeometry args={[toolDiameter / 2, toolDiameter / 2, 60, 24]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.9} />
      </mesh>
    </>
  );
};

const GhostPath: React.FC<{ built: Built }> = React.memo(({ built }) => {
  const positions = React.useMemo(() => {
    const pts = new Float32Array(built.steps.length * 6);
    let i = 0;
    for (const seg of built.steps) {
      pts[i++] = seg.a.x;
      pts[i++] = seg.a.y;
      pts[i++] = seg.a.z;
      pts[i++] = seg.b.x;
      pts[i++] = seg.b.y;
      pts[i++] = seg.b.z;
    }
    return pts;
  }, [built]);

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#64748b" transparent opacity={0.5} />
    </lineSegments>
  );
});
GhostPath.displayName = 'GhostPath';

// ─────────────────────────────── обёртка + UI ───────────────────────────────

const Scene3D: React.FC = () => {
  // Только стабильные значения из стора (ссылка/примитив/функция) — иначе селектор
  // вернёт новый объект каждый вызов и useSyncExternalStore уйдёт в ре-рендер-цикл.
  const segments = useProjectStore((s) => s.toolpathSegments);
  const machine = useProjectStore((s) => s.machine);
  const setSimActiveLayerId = useProjectStore((s) => s.setSimActiveLayerId);

  const toolDiameter = machine.toolDiameter ?? 3;
  const built = React.useMemo(() => buildScene(segments, toolDiameter, machine), [segments, toolDiameter, machine]);

  // Единый источник «часов» симуляции — мутабельный ref, вне undoable-стора.
  const clockRef = React.useRef<Clock>({ prog: 0, playing: false, speed: 150, done: false, total: 0 });
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(150);
  const [, forceRender] = React.useState(0);
  const progLabelRef = React.useRef<HTMLSpanElement>(null);

  // Любое изменение геометрии/инструмента (новая ссылка на toolpathSegments, другой
  // диаметр фрезы) — сброс и пауза симуляции. Превью-состояние живёт в ref, не в объектах.
  React.useEffect(() => {
    clockRef.current.prog = 0;
    clockRef.current.done = false;
    clockRef.current.playing = false;
    setPlaying(false);
  }, [built]);

  React.useEffect(() => {
    clockRef.current.speed = speed;
  }, [speed]);

  const togglePlay = () => {
    const c = clockRef.current;
    if (c.done) {
      c.prog = 0;
      c.done = false;
    }
    c.playing = !c.playing;
    setPlaying(c.playing);
  };

  const reset = () => {
    const c = clockRef.current;
    c.prog = 0;
    c.done = false;
    c.playing = false;
    setPlaying(false);
    forceRender((v) => v + 1);
  };

  const camDist = built ? built.span * 1.15 : 2000;
  const center = built ? new THREE.Vector3(built.board.cx, 0, built.board.cz) : new THREE.Vector3(0, 0, 0);

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900">
      <Canvas
        camera={{ position: [center.x + camDist, camDist * 0.9, center.z + camDist], fov: 45, near: 1, far: camDist * 20 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <SceneContents
          built={built}
          toolDiameter={toolDiameter}
          clockRef={clockRef}
          onActiveLayer={setSimActiveLayerId}
          labelRef={progLabelRef}
          onDone={() => setPlaying(false)}
        />
        <OrbitControls
          makeDefault
          target={[center.x, center.y, center.z]}
          maxPolarAngle={Math.PI / 2.05}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.DOLLY,
          }}
        />
      </Canvas>

      {/* Верхняя подсказка — в 3D-режиме инструментов черчения нет. */}
      <div className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur dark:bg-slate-950/70">
        3D-просмотр · ЛКМ — вращение · колесо — зум · нажатое колесо — панорама
      </div>

      {/* Панель симуляции (play/pause/reset/speed) — вне холста, живёт в ref-часах. */}
      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-2.5 shadow-md dark:border-slate-700 dark:bg-slate-900/95">
          <button
            onClick={togglePlay}
            disabled={!built || built.steps.length === 0}
            title={playing ? 'Пауза' : 'Проиграть съём фрезой'}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg disabled:opacity-40"
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5v11a1 1 0 0 0 1.54.84l8-5.5a1 1 0 0 0 0-1.68l-8-5.5A1 1 0 0 0 4 2.5Z" />
              </svg>
            )}
          </button>
          <button
            onClick={reset}
            disabled={!built || built.steps.length === 0}
            title="Сбросить в начало"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            Скорость
            <input
              type="range"
              min={20}
              max={600}
              step={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-28 accent-[var(--color-primary,#2563eb)]"
            />
            <span className="w-[64px] font-mono text-slate-500 dark:text-slate-400">{speed} мм/с</span>
          </label>

          <span ref={progLabelRef} className="min-w-[64px] text-right font-mono text-xs text-slate-500 dark:text-slate-400">
            0 / 0
          </span>
        </div>
      </div>

      {(!built || built.steps.length === 0) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 text-sm text-slate-500 shadow dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400">
            Нет траектории. Нарисуйте контур/линии во вкладке 2D — паз появится здесь.
          </div>
        </div>
      )}
    </div>
  );
};

export default Scene3D;

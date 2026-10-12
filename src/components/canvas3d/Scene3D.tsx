import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';
import { ToolpathSegment } from '../../types';

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

// Данные одного сегмента таймлайна для движения фрезы.
interface MotionSeg {
  a: THREE.Vector3; // старт (в сцене)
  b: THREE.Vector3; // конец (в сцене)
}

interface Built {
  grooves: GroovePiece[];
  // Порядок grooves совпадает с порядком сегментов; segIndexOfGroove[k] = индекс
  // сегмента-источника в motion[], чтобы по текущему индексу понять сколько пазов
  // уже «прорезано».
  segIndexOfGroove: number[];
  motion: MotionSeg[];
  board: { cx: number; cy: number; cz: number; w: number; h: number; d: number };
  span: number;
}

function buildScene(segs: ToolpathSegment[], toolDiameter: number): Built | null {
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

  // Заготовка = габарит обрабатываемого содержимого + отступ (не зона хода станка:
  // bounds — это.travel, а не лист). Иначе деталь тонула бы в огромной плите.
  const margin = 40 + toolDiameter;
  const bw = maxX - minX + margin * 2;
  const bd = maxY - minY + margin * 2;
  const cxWorld = (minX + maxX) / 2;
  const czWorld = (minY + maxY) / 2;
  // Толщина заготовки: минимум 16 мм (ДСП), но не тоньше самого глубокого вреза.
  const thickness = Math.max(16, Math.abs(minZ) + 4);

  const board = {
    cx: cxWorld,
    cy: -thickness / 2,
    cz: -czWorld,
    w: bw,
    h: thickness,
    d: bd,
  };

  const grooves: GroovePiece[] = [];
  const segIndexOfGroove: number[] = [];
  const motion: MotionSeg[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();

  segs.forEach((s, idx) => {
    const [ax, ay, az] = toScene(s.startX, s.startY, s.startZ);
    const [bx, by, bz] = toScene(s.endX, s.endY, s.endZ);
    motion.push({ a: new THREE.Vector3(ax, ay, az), b: new THREE.Vector3(bx, by, bz) });

    if (!isGroove(s)) return;

    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const depth = Math.max(Math.abs(s.endZ), 0.2);
    // Небольшой «зазор» над поверхностью: плита непрозрачна, поэтому паз должен
    // выступать на 0.5 мм, иначе его перекрывает верхняя грань заготовки (z-fighting).
    const lip = 0.5;

    let angleY = 0;
    let length = len;
    if (len < 0.01) {
      // Сверловка / точка: квадратное сечение ≈ пятно фрезы.
      length = toolDiameter;
    } else {
      angleY = Math.atan2(dx, dz);
    }

    q.setFromAxisAngle(up, angleY);
    pos.set((ax + bx) / 2, (lip - depth) / 2, (az + bz) / 2);
    scl.set(toolDiameter, depth + lip, length);
    m.compose(pos, q, scl);
    grooves.push({ matrix: m.clone() });
    segIndexOfGroove.push(idx);
  });

  const span = Math.max(bw, bd);
  return { grooves, segIndexOfGroove, motion, board, span };
}

// Верхняя граница: сколько pазов уже прорезано, если текущий сегмент = currentSeg.
function revealedCount(segIndexOfGroove: number[], currentSeg: number): number {
  let lo = 0,
    hi = segIndexOfGroove.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segIndexOfGroove[mid] <= currentSeg) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface Clock {
  prog: number;
  playing: boolean;
  speed: number; // сегментов в секунду
  done: boolean;
  total: number;
}

interface SceneContentsProps {
  built: Built | null;
  toolDiameter: number;
  clockRef: React.MutableRefObject<Clock>;
}

const SceneContents: React.FC<SceneContentsProps> = ({ built, toolDiameter, clockRef }) => {
  const instRef = React.useRef<THREE.InstancedMesh>(null);
  const cutterRef = React.useRef<THREE.Mesh>(null);

  // Разложить предрассчитанные матрицы пазов по буферу инстансов (один раз на построение).
  React.useLayoutEffect(() => {
    const mesh = instRef.current;
    if (!mesh || !built) return;
    built.grooves.forEach((g, i) => mesh.setMatrixAt(i, g.matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
    clockRef.current.total = built.motion.length;
    clockRef.current.prog = 0;
    clockRef.current.done = false;
  }, [built, clockRef]);

  useFrame((_, delta) => {
    const clock = clockRef.current;
    if (!built || built.motion.length === 0) return;
    const mesh = instRef.current;
    const total = built.motion.length;

    if (clock.playing && !clock.done) {
      clock.prog += delta * clock.speed;
      if (clock.prog >= total) {
        clock.prog = total;
        clock.done = true;
        clock.playing = false;
      }
    }

    const currentSeg = Math.min(Math.floor(clock.prog), total - 1);
    if (mesh) {
      const reveal = revealedCount(built.segIndexOfGroove, clock.prog > 0 ? currentSeg : -1);
      if (mesh.count !== reveal) mesh.count = reveal;
    }

    // Фреза: интерполяция внутри текущего сегмента.
    const cutter = cutterRef.current;
    if (cutter) {
      const t = Math.max(0, Math.min(1, clock.prog - currentSeg));
      const seg = built.motion[currentSeg];
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
  const geom = React.useMemo(() => {
    const pts: number[] = [];
    for (const seg of built.motion) {
      pts.push(seg.a.x, seg.a.y, seg.a.z, seg.b.x, seg.b.y, seg.b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [built]);

  React.useEffect(() => () => geom.dispose(), [geom]);

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={new THREE.Color('#64748b')} transparent opacity={0.5} />
    </lineSegments>
  );
});
GhostPath.displayName = 'GhostPath';

// ─────────────────────────────── обёртка + UI ───────────────────────────────

const Scene3D: React.FC = () => {
  // Только стабильные значения из стора (ссылка/примитив) — иначе селектор вернёт
  // новый объект каждый вызов и useSyncExternalStore уйдёт в бесконечный ре-рендер.
  const segments = useProjectStore((s) => s.toolpathSegments);
  const toolDiameter = useProjectStore((s) => s.machine.toolDiameter ?? 3);

  const built = React.useMemo(() => buildScene(segments, toolDiameter), [segments, toolDiameter]);

  // Единый источник «часов» симуляции — мутабельный ref, вне undoable-стора.
  const clockRef = React.useRef<Clock>({ prog: 0, playing: false, speed: 60, done: false, total: 0 });
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(60);
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

  // Лёгкий отдельный rAF только для подписи прогресса — пишет textContent напрямую,
  // не дёргая React и не заставляя ре-рендериться поддерево <Canvas>.
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = progLabelRef.current;
      const c = clockRef.current;
      if (el) {
        const cur = Math.min(Math.floor(c.prog), c.total);
        el.textContent = `${cur} / ${c.total}`;
      }
      // useFrame гасит clockRef.playing при завершении, а React-состояние «playing»
      // остаётся — синхронизируем иконку (setPlaying с тем же значением = no-op).
      if (c.done) setPlaying(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const camDist = built ? built.span * 1.15 : 2000;
  const center = built ? new THREE.Vector3(built.board.cx, 0, built.board.cz) : new THREE.Vector3(0, 0, 0);

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900">
      <Canvas
        camera={{ position: [center.x + camDist, camDist * 0.9, center.z + camDist], fov: 45, near: 1, far: camDist * 20 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <SceneContents built={built} toolDiameter={toolDiameter} clockRef={clockRef} />
        <OrbitControls makeDefault target={[center.x, center.y, center.z]} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>

      {/* Верхняя подсказка — в 3D-режиме инструментов черчения нет. */}
      <div className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur dark:bg-slate-950/70">
        3D-просмотр · ЛКМ — вращение · колесо — зум · ПКМ — панорама
      </div>

      {/* Панель симуляции (play/pause/reset/speed) — вне холста, живёт в ref-часах. */}
      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-2.5 shadow-md dark:border-slate-700 dark:bg-slate-900/95">
          <button
            onClick={togglePlay}
            disabled={!built || built.motion.length === 0}
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
            disabled={!built || built.motion.length === 0}
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
              min={10}
              max={300}
              step={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-24 accent-[var(--color-primary,#2563eb)]"
            />
          </label>

          <span ref={progLabelRef} className="min-w-[64px] text-right font-mono text-xs text-slate-500 dark:text-slate-400">
            0 / 0
          </span>
        </div>
      </div>

      {(!built || built.motion.length === 0) && (
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

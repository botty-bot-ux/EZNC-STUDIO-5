import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useProjectStore } from '../../store/useProjectStore';
import {
  buildGridLines,
  buildScene,
  BuiltSimulation,
  revealedCount,
} from './buildSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// Симуляция съёма фрезой в 3D.
//
// Чистый ПОТРЕБИТЕЛЬ состояния: читает toolpathSegments (уже Z-aware из
// генератора G-кода) и machine.toolDiameter (ширина паза = диаметр фрезы).
// Ничего не пишет в стор, не создаёт вторую логику правки геометрии.
// ─────────────────────────────────────────────────────────────────────────────

interface Clock {
  prog: number;
  playing: boolean;
  speed: number; // мм/с — постоянная скорость перемещения фрезы по XY
  done: boolean;
  total: number;
}

interface SceneContentsProps {
  built: BuiltSimulation | null;
  toolDiameter: number;
  clockRef: React.MutableRefObject<Clock>;
  onActiveLayer: (id: string | null) => void;
  labelRef: React.RefObject<HTMLSpanElement | null>;
  sliderRef: React.RefObject<HTMLInputElement | null>;
  onDone: () => void;
}

const CameraCapture: React.FC<{ cameraRef: React.MutableRefObject<THREE.Camera | null> }> = ({ cameraRef }) => {
  const { camera } = useThree();
  React.useEffect(() => {
    cameraRef.current = camera;
  }, [camera, cameraRef]);
  return null;
};

const SceneContents: React.FC<SceneContentsProps> = ({ built, toolDiameter, clockRef, onActiveLayer, labelRef, sliderRef, onDone }) => {
  const instRef = React.useRef<THREE.InstancedMesh>(null);
  const cutterRef = React.useRef<THREE.Mesh>(null);
  const lastActiveIdRef = React.useRef<string | null>(null);
  // Активный слой копили микрозадачей вне кадра (см. useFrame): pending — желаемое
  // значение, queued — гарантия не более одной записи в очереди.
  const pendingActiveIdRef = React.useRef<string | null>(null);
  const activeLayerQueuedRef = React.useRef(false);

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
    if (sliderRef.current) {
      sliderRef.current.max = String(built.steps.length);
      sliderRef.current.value = '0';
    }
    lastActiveIdRef.current = null;
    pendingActiveIdRef.current = null;
    onActiveLayer(null);
  }, [built, clockRef, onActiveLayer, sliderRef]);

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

    // Подпись прогресса и ползунок обновляем прямо из useFrame — один владелец цикла анимации.
    const stepped = Math.min(Math.floor(clock.prog), total);
    if (labelRef.current) {
      labelRef.current.textContent = `${stepped} / ${total}`;
    }
    if (sliderRef.current) {
      const maxStr = String(total);
      if (sliderRef.current.max !== maxStr) sliderRef.current.max = maxStr;
      sliderRef.current.value = String(stepped);
    }

    // Активный слой = фигура текущего шага; пишем в стор только при смене.
    const activeId = clock.prog > 0 ? built.steps[currentStep].objectId ?? null : null;
    if (activeId !== lastActiveIdRef.current) {
      lastActiveIdRef.current = activeId;
      // Уводим запись в стор из горячего кадра: синхронный onActiveLayer ре-рендерит
      // панель слоёв прямо внутри useFrame. Копим желаемое значение и льём одним
      // queueMicrotask (не более одной записи в очереди) уже после тика кадра.
      pendingActiveIdRef.current = activeId;
      if (!activeLayerQueuedRef.current) {
        activeLayerQueuedRef.current = true;
        queueMicrotask(() => {
          activeLayerQueuedRef.current = false;
          onActiveLayer(pendingActiveIdRef.current);
        });
      }
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
      if (spinning) cutter.rotation.y = (cutter.rotation.y + delta * 12) % (Math.PI * 2);
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

      {/* Фреза (видна только когда есть траектория; крутится лишь при съёме) */}
      <mesh ref={cutterRef} visible={!!built}>
        <cylinderGeometry args={[toolDiameter / 2, toolDiameter / 2, 60, 24]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.9} />
      </mesh>
    </>
  );
};

const GhostPath: React.FC<{ built: BuiltSimulation }> = React.memo(({ built }) => {
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

// ─────────── сетка-«пол» под листом (повторяет двухуровневую сетку 2D) ───────────

interface FloorGridProps {
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  step: number;
  floorY: number;
}

const FloorGrid: React.FC<FloorGridProps> = React.memo(({ bounds, step, floorY }) => {
  const xMin = Math.min(bounds.xMin, bounds.xMax);
  const xMax = Math.max(bounds.xMin, bounds.xMax);
  const yMin = Math.min(bounds.yMin, bounds.yMax);
  const yMax = Math.max(bounds.yMin, bounds.yMax);
  const minor = React.useMemo(() => buildGridLines(xMin, xMax, yMin, yMax, step, floorY, false), [xMin, xMax, yMin, yMax, step, floorY]);
  const major = React.useMemo(() => buildGridLines(xMin, xMax, yMin, yMax, step, floorY, true), [xMin, xMax, yMin, yMax, step, floorY]);
  return (
    <>
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[minor, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.6} />
      </lineSegments>
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[major, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#475569" transparent opacity={0.95} />
      </lineSegments>
    </>
  );
});
FloorGrid.displayName = 'FloorGrid';

// ─────────── подписи размеров заготовки на осях X / Y (на полу) ───────────

interface BoardDimensionsProps {
  board: { cx: number; cz: number; w: number; d: number };
  floorY: number;
}

const BoardDimensions: React.FC<BoardDimensionsProps> = React.memo(({ board, floorY }) => {
  const w = Math.round(board.w);
  const d = Math.round(board.d);
  // Вынос за габарит листа и размер шрифта — от масштаба плиты (мир в мм).
  const off = Math.max(board.w, board.d) * 0.05;
  const fs = Math.max(50, Math.round(Math.max(board.w, board.d) * 0.045));
  const isDark = useProjectStore((s) => s.theme === 'dark');
  const textColor = isDark ? '#e5e7eb' : '#111827';
  return (
    <>
      {/* X — ребро вдоль сцены-X (ширина листа widthX), по переднему краю пола. */}
      <group position={[board.cx, floorY + 1, board.cz + board.d / 2 + off]} rotation={[-Math.PI / 2, 0, 0]}>
        <Text fontSize={fs} color={textColor} anchorX="center" anchorY="middle">
          {`X · ${w} мм`}
        </Text>
      </group>
      {/* Y — ребро вдоль сцены-Z (глубина листа widthY), по правому краю пола. */}
      <group position={[board.cx + board.w / 2 + off, floorY + 1, board.cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <Text fontSize={fs} color={textColor} anchorX="center" anchorY="middle">
            {`Y · ${d} мм`}
          </Text>
        </group>
      </group>
    </>
  );
});
BoardDimensions.displayName = 'BoardDimensions';

// ─────────────────────────────── обёртка + UI ───────────────────────────────

// Скорость симуляции — дискретные множители; «×1» = базовая подача 1000 мм/с.
type SpeedMul = 0.5 | 1 | 2 | 5;
const BASE_MM_S = 1000;
const SPEED_STEPS: SpeedMul[] = [0.5, 1, 2, 5];

const Scene3D: React.FC = () => {
  // Только стабильные значения из стора (ссылка/примитив/функция) — иначе селектор
  // вернёт новый объект каждый вызов и useSyncExternalStore уйдёт в ре-рендер-цикл.
  const segments = useProjectStore((s) => s.toolpathSegments);
  const machine = useProjectStore((s) => s.machine);
  const setSimActiveLayerId = useProjectStore((s) => s.setSimActiveLayerId);

  const toolDiameter = machine.toolDiameter ?? 3;
  const built = React.useMemo(() => buildScene(segments, toolDiameter, machine), [segments, toolDiameter, machine]);

  // Единый источник «часов» симуляции — мутабельный ref, вне undoable-стора.
  const clockRef = React.useRef<Clock>({ prog: 0, playing: false, speed: BASE_MM_S, done: false, total: 0 });
  const [playing, setPlaying] = React.useState(false);
  const [speedMul, setSpeedMul] = React.useState<SpeedMul>(1);
  const [, forceRender] = React.useState(0);
  const progLabelRef = React.useRef<HTMLSpanElement>(null);
  const sliderRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<THREE.Camera | null>(null);

  // Любое изменение геометрии/инструмента (новая ссылка на toolpathSegments, другой
  // диаметр фрезы) — сброс и пауза симуляции. Превью-состояние живёт в ref, не в объектах.
  React.useEffect(() => {
    clockRef.current.prog = 0;
    clockRef.current.done = false;
    clockRef.current.playing = false;
    setPlaying(false);
    if (sliderRef.current) sliderRef.current.value = '0';
  }, [built]);

  React.useEffect(() => {
    clockRef.current.speed = speedMul * BASE_MM_S;
  }, [speedMul]);

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
    if (sliderRef.current) sliderRef.current.value = '0';
    forceRender((v) => v + 1);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const c = clockRef.current;
    c.playing = false;
    setPlaying(false);
    c.prog = val;
    c.done = c.total > 0 && val >= c.total;
  };

  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const camDist = built ? built.span * 1.15 : 2000;
  const center = React.useMemo(
    () => (built ? new THREE.Vector3(built.board.cx, 0, built.board.cz) : new THREE.Vector3(0, 0, 0)),
    [built]
  );

  React.useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.copy(center);
    controls.update();
  }, [center]);

  const setCameraPreset = (preset: 'top' | 'iso') => {
    const cam = cameraRef.current;
    const controls = controlsRef.current;
    if (!cam || !controls) return;
    if (preset === 'top') {
      // Небольшой сдвиг по Z исключает вырождение OrbitControls на полярном угле 0.
      cam.position.set(center.x, center.y + camDist * 1.45, center.z + 0.5);
    } else {
      cam.position.set(center.x + camDist, camDist * 0.9, center.z + camDist);
    }
    controls.target.copy(center);
    controls.update();
  };

  // Сетка-пол: шаг подбираем по габариту рабочей зоны (≈не более ~40 ячеек по
  // большей оси), как в 2D подбираем динамический step; пол — чуть ниже дна листа.
  const gb = machine.bounds;
  const gExtent = Math.max(Math.abs(gb.xMax - gb.xMin), Math.abs(gb.yMax - gb.yMin));
  const gridStep = [10, 20, 25, 50, 100, 200, 250, 500].find((c) => gExtent / c <= 40) ?? 500;
  const floorY = built ? built.board.cy - built.board.h / 2 - 1 : -1;

  return (
    <div className="absolute inset-0 bg-canvas">
      <Canvas
        camera={{ position: [center.x + camDist, camDist * 0.9, center.z + camDist], fov: 45, near: 1, far: camDist * 20 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <CameraCapture cameraRef={cameraRef} />
        <FloorGrid bounds={machine.bounds} step={gridStep} floorY={floorY} />
        {built && <BoardDimensions board={built.board} floorY={floorY} />}
        <SceneContents
          built={built}
          toolDiameter={toolDiameter}
          clockRef={clockRef}
          onActiveLayer={setSimActiveLayerId}
          labelRef={progLabelRef}
          sliderRef={sliderRef}
          onDone={() => setPlaying(false)}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          maxPolarAngle={Math.PI / 2.05}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.DOLLY,
          }}
        />
      </Canvas>

      {/* Быстрые ракурсы 3D-камеры и подсказка управления */}
      <div className="pointer-events-auto absolute top-3 left-3 flex items-center gap-1 rounded-lg border border-line bg-surface/92 backdrop-blur-md p-1 shadow-sm select-none">
        <button
          type="button"
          onClick={() => setCameraPreset('top')}
          title="Вид строго сверху на плиту"
          className="px-2.5 py-1 rounded-md text-xs font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
        >
          Сверху
        </button>
        <button
          type="button"
          onClick={() => setCameraPreset('iso')}
          title="Изометрический обзор 3D"
          className="px-2.5 py-1 rounded-md text-xs font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
        >
          Изометрия
        </button>
      </div>

      <div className="pointer-events-none hidden md:flex absolute top-3 right-3 items-center gap-2 rounded-lg border border-line bg-surface/90 backdrop-blur-md px-2.5 py-1.5 text-[11px] text-muted select-none">
        <span>ЛКМ — вращение</span>
        <span aria-hidden="true">·</span>
        <span>Колесо — масштаб</span>
        <span aria-hidden="true">·</span>
        <span>СКМ — панорама</span>
      </div>

      {/* Панель симуляции (play/pause/reset/scrubber/speed) */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center px-3 pointer-events-none select-none">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 rounded-lg border border-line bg-surface/95 backdrop-blur-md px-3 py-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.45)]">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!built || built.steps.length === 0}
            title={playing ? 'Пауза' : 'Проиграть съём фрезой'}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg disabled:opacity-40 cursor-pointer"
          >
            {playing ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!built || built.steps.length === 0}
            title="Сбросить в начало"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-subtle text-fg-secondary hover:text-fg hover:bg-surface-hover disabled:opacity-40 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-5 w-px bg-line hidden sm:block" />

          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={built?.steps.length ?? 0}
            step={1}
            defaultValue={0}
            disabled={!built || built.steps.length === 0}
            onChange={handleScrub}
            title="Перемотать симуляцию к нужному шагу"
            className="w-24 sm:w-40 md:w-52 accent-accent cursor-pointer disabled:opacity-40 disabled:cursor-default"
          />

          <div className="h-5 w-px bg-line" />

          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <span className="hidden sm:inline">Скорость</span>
            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-subtle p-0.5">
              {SPEED_STEPS.map((m) => (
                <button
                  key={m}
                  onClick={() => setSpeedMul(m)}
                  title={`${Math.round(m * BASE_MM_S)} мм/с`}
                  className={`rounded-md px-2 py-1 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    speedMul === m
                      ? 'bg-primary text-primary-fg'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  ×{m}
                </button>
              ))}
            </div>
          </div>

          <span ref={progLabelRef} className="min-w-[68px] text-right font-mono text-xs text-muted">
            0 / 0
          </span>
        </div>
      </div>

      {(!built || built.steps.length === 0) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="rounded-xl border border-line bg-surface/95 px-5 py-3.5 text-xs text-muted shadow-md">
            Нет траектории. Нарисуйте линии или контур в режиме 2D — симуляция съёма появится здесь.
          </div>
        </div>
      )}
    </div>
  );
};

export default Scene3D;

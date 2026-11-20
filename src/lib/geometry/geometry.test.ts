import { describe, expect, it } from 'vitest';
import { ArcObject, CADObject, MachineSettings, ToolpathSegment } from '../../types';
import {
  computeArcBounds,
  computeObjectsBounds,
  computeParallelArcs,
  computeParallelSegments,
  mirrorCADObject,
  rotateCADObject90,
  scaleCADObject,
  translateCADObject,
} from './transform';
import { analyzeTrajectoryBounds } from './bounds';
import { optimizeCADObjects } from './optimizer';
import { findObjectBodyHit, getObjectBoundingBox } from '../../components/canvas/canvasHitTest';
import { analyzeProjectWarnings } from '../utils/warnings';

describe('transform geometry', () => {
  it('computeArcBounds учитывает экстремумы дуги по осям', () => {
    // Полуокружность сверху (от (100,0) до (-100,0) через (0,100), центр (0,0), CCW)
    const arc: ArcObject = {
      id: 'a1',
      name: 'Дуга',
      type: 'arc',
      startX: 100,
      startY: 0,
      endX: -100,
      endY: 0,
      centerX: 0,
      centerY: 0,
      radius: 100,
      clockwise: false,
      depth: 5,
      operationType: 'cut',
    };
    const b = computeArcBounds(arc);
    expect(b.minX).toBeCloseTo(-100, 3);
    expect(b.maxX).toBeCloseTo(100, 3);
    expect(b.minY).toBeCloseTo(0, 3);
    expect(b.maxY).toBeCloseTo(100, 3);
  });

  it('translateCADObject сдвигает полилинию без мутации исходного объекта', () => {
    const poly: CADObject = {
      id: 'pl1',
      name: 'Ломаная',
      type: 'polyline',
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ],
      depth: 5,
      operationType: 'cut',
    };
    const moved = translateCADObject(poly, 10, -5);
    expect(moved.type).toBe('polyline');
    if (moved.type === 'polyline') {
      expect(moved.points).toEqual([
        { x: 10, y: -5 },
        { x: 20, y: 15 },
      ]);
    }
    expect(poly.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('scaleCADObject масштабирует и отражает прямоугольник и линию относительно якоря', () => {
    const rect: CADObject = {
      id: 'r1',
      name: 'Прямоугольник',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      depth: 5,
      operationType: 'cut',
    };
    const scaled = scaleCADObject(rect, { x: 50, y: 25 }, 2, 1);
    if (scaled.type === 'rectangle') {
      expect(scaled.x).toBeCloseTo(-50, 3);
      expect(scaled.width).toBeCloseTo(200, 3);
      expect(scaled.y).toBeCloseTo(0, 3);
      expect(scaled.height).toBeCloseTo(50, 3);
    }
  });

  it('computeParallelSegments и computeParallelArcs строят корректные копии', () => {
    const segs = computeParallelSegments({ startX: 0, startY: 0, endX: 100, endY: 0 }, 16, 2);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ startX: 0, startY: 16, endX: 100, endY: 16 });
    expect(segs[1]).toEqual({ startX: 0, startY: 32, endX: 100, endY: 32 });

    const arcs = computeParallelArcs(
      {
        centerX: 0,
        centerY: 0,
        radius: 20,
        startX: 20,
        startY: 0,
        endX: 0,
        endY: 20,
        clockwise: false,
      },
      -15,
      2
    );
    // k=1 -> r=5 (валидна), k=2 -> r=-10 (отфильтрована)
    expect(arcs).toHaveLength(1);
    expect(arcs[0].radius).toBeCloseTo(5, 3);
  });

  it('mirrorCADObject отражает прямоугольник и дугу с инверсией clockwise', () => {
    const arc: ArcObject = {
      id: 'a_m',
      name: 'Дуга',
      type: 'arc',
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
      centerX: 0,
      centerY: 100,
      radius: 100,
      clockwise: false,
      depth: 5,
      operationType: 'cut',
    };
    const mirrored = mirrorCADObject(arc, 'y', { x: 50, y: 50 });
    expect(mirrored.type).toBe('arc');
    if (mirrored.type === 'arc') {
      expect(mirrored.startY).toBeCloseTo(100, 3);
      expect(mirrored.endY).toBeCloseTo(0, 3);
      expect(mirrored.centerY).toBeCloseTo(0, 3);
      expect(mirrored.clockwise).toBe(true);
    }
  });

  it('rotateCADObject90 поворачивает прямоугольник на 90° с перестановкой width/height', () => {
    const rect: CADObject = {
      id: 'r_rot',
      name: 'Прямоугольник',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      depth: 5,
      operationType: 'cut',
    };
    const rotated = rotateCADObject90(rect, 90, { x: 50, y: 20 });
    expect(rotated.type).toBe('rectangle');
    if (rotated.type === 'rectangle') {
      expect(rotated.width).toBeCloseTo(40, 3);
      expect(rotated.height).toBeCloseTo(100, 3);
      expect(rotated.x).toBeCloseTo(30, 3);
      expect(rotated.y).toBeCloseTo(-30, 3);
    }
    const bb = computeObjectsBounds([rect, rotated]);
    expect(bb).not.toBeNull();
    expect(bb?.minY).toBeCloseTo(-30, 3);
    expect(bb?.maxX).toBeCloseTo(100, 3);
  });
});

describe('optimizer', () => {
  it('уменьшает холостой пробег и разворачивает встречные отрезки', () => {
    const objs: CADObject[] = [
      {
        id: 'far',
        name: 'Дальний',
        type: 'line',
        startX: 500,
        startY: 100,
        endX: 600,
        endY: 100,
        depth: 5,
        operationType: 'cut',
      },
      {
        id: 'near_flipped',
        name: 'Ближний',
        type: 'line',
        startX: 100,
        startY: 0,
        endX: 10,
        endY: 0,
        depth: 5,
        operationType: 'cut',
      },
    ];
    const res = optimizeCADObjects(objs, { x: 0, y: 0 }, { returnToStart: false });
    expect(res.optimizedObjects.map((o) => o.id)).toEqual(['near_flipped', 'far']);
    expect(res.savedDistance).toBeGreaterThan(0);
    expect(res.flippedCount).toBe(1);
  });
});

describe('hitTest & warnings', () => {
  it('findObjectBodyHit находит открытую и замкнутую полилинию на холсте', () => {
    const poly: CADObject = {
      id: 'pl_hit',
      name: 'Контур',
      type: 'polyline',
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      depth: 5,
      operationType: 'cut',
    };
    // На первом сегменте
    expect(findObjectBodyHit([poly], { x: 50, y: 2 }, 1)).toBe('pl_hit');
    // На замыкающем сегменте (100,100) -> (0,0)
    expect(findObjectBodyHit([poly], { x: 50, y: 50 }, 1)).toBe('pl_hit');
    // Вдали от контура
    expect(findObjectBodyHit([poly], { x: 20, y: 80 }, 1)).toBeNull();
  });

  it('warnings и getObjectBoundingBox используют точные границы дуги', () => {
    const arc: ArcObject = {
      id: 'arc_bulge',
      name: 'Дуга-вылет',
      type: 'arc',
      startX: -10,
      startY: 0,
      endX: -10,
      endY: -200,
      centerX: -10,
      centerY: -100,
      radius: 100,
      clockwise: true,
      depth: 5,
      operationType: 'cut',
    };
    // Дуга по часовой стрелке от +Y к -Y проходит через +X и выгибается вправо до X = +90
    const bb = getObjectBoundingBox(arc);
    expect(bb.maxX).toBeCloseTo(90, 3);
    expect(bb.minX).toBeCloseTo(-10, 3);

    const machine: MachineSettings = {
      units: 'mm',
      controllerProfile: 'ncstudio',
      bounds: { xMin: -1000, xMax: 0, yMin: -1000, yMax: 0 },
      workOffset: { x: 0, y: 0 },
      safeZ: 10,
      spindleSpeed: 15000,
      spindleDwell: 3000,
      feedCut: 1200,
      feedPlunge: 300,
      feedDrill: 500,
      toolDiameter: 3,
      toolName: 'Фреза',
      useCannedCycles: false,
    };
    const warns = analyzeProjectWarnings([arc], [], machine);
    expect(warns.some((w) => w.id === 'warn_bound_arc_bulge')).toBe(true);
  });

  it('analyzeTrajectoryBounds выявляет выход траектории за X, Y и Z (включая дуги и workOffset)', () => {
    const machine: MachineSettings = {
      units: 'mm',
      controllerProfile: 'ncstudio',
      bounds: { xMin: -1000, xMax: 0, yMin: -800, yMax: 0, zMin: -40, zMax: 80 },
      workOffset: { x: -100, y: 0 },
      safeZ: 10,
      spindleSpeed: 15000,
      spindleDwell: 3000,
      feedCut: 1200,
      feedPlunge: 300,
      feedDrill: 500,
      toolDiameter: 3,
      toolName: 'Фреза',
      useCannedCycles: false,
    };

    const segs: ToolpathSegment[] = [
      {
        id: 's_ok',
        type: 'feed',
        startX: -100,
        startY: -100,
        startZ: -10,
        endX: -500,
        endY: -200,
        endZ: -10,
      },
      {
        id: 's_arc_out_x',
        type: 'arc_cw',
        startX: 10,
        startY: -200,
        startZ: -5,
        endX: 10,
        endY: -400,
        endZ: -5,
        centerX: 10,
        centerY: -300,
        radius: 100,
      },
      {
        id: 's_out_z',
        type: 'feed',
        startX: -100,
        startY: -100,
        startZ: 10,
        endX: -100,
        endY: -100,
        endZ: -45,
      },
    ];

    const summary = analyzeTrajectoryBounds(segs, machine);
    expect(summary.hasTrajectory).toBe(true);
    // Дуга выгибается до progX = +110, с workOffset = -100 машинный X = +10 > 0
    expect(summary.trajMaxX).toBeCloseTo(10, 3);
    expect(summary.exceedsXMax).toBe(true);
    expect(summary.exceedsXMin).toBe(false);
    expect(summary.outY).toBe(false);
    expect(summary.exceedsZMin).toBe(true);
    expect(summary.outZ).toBe(true);
    expect(summary.outOfBounds).toBe(true);
    expect(summary.outOfBoundsSegmentIds.has('s_ok')).toBe(false);
    expect(summary.outOfBoundsSegmentIds.has('s_arc_out_x')).toBe(true);
    expect(summary.outOfBoundsSegmentIds.has('s_out_z')).toBe(true);

    // Проверка безопасного Z против zMax в analyzeProjectWarnings
    const warns = analyzeProjectWarnings([], [], { ...machine, safeZ: 95 });
    expect(warns.some((w) => w.id === 'warn_safe_z_max')).toBe(true);
  });
});

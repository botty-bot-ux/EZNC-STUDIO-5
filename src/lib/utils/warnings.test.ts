import { describe, expect, it } from 'vitest';
import { CADObject, MachineSettings } from '../../types';
import { analyzeProjectWarnings } from './warnings';

const baseMachine: MachineSettings = {
  units: 'mm',
  controllerProfile: 'ncstudio',
  bounds: { xMin: -1000, xMax: 0, yMin: -2000, yMax: 0, zMin: -40, zMax: 80 },
  workOffset: { x: 0, y: 0 },
  safeZ: 10,
  cutDepth: 16,
  spindleSpeed: 15000,
  spindleDwell: 3000,
  feedCut: 1200,
  feedPlunge: 500,
  feedDrill: 500,
  toolDiameter: 8,
  toolName: 'Фреза 8мм',
  useCannedCycles: true,
};

describe('analyzeProjectWarnings', () => {
  it('не выдаёт предупреждений для корректного проекта внутри границ станка', () => {
    const objs: CADObject[] = [
      { id: 'l1', name: 'Отрезок', type: 'line', startX: -100, startY: -100, endX: -400, endY: -300, depth: 16, operationType: 'cut' },
      { id: 'p1', name: 'Отверстие', type: 'point', x: -200, y: -200, diameter: 11, depth: 33, drillMode: '11mm', operationType: 'drill' },
    ];
    expect(analyzeProjectWarnings(objs, [], baseMachine)).toEqual([]);
  });

  it('обнаруживает опасные параметры станка (safeZ, подачи, шпиндель)', () => {
    const badSafeZLow = analyzeProjectWarnings([], [], { ...baseMachine, safeZ: 0 });
    expect(badSafeZLow.some((w) => w.id === 'warn_safe_z' && w.level === 'error')).toBe(true);

    const badSafeZHigh = analyzeProjectWarnings([], [], { ...baseMachine, safeZ: 120 });
    expect(badSafeZHigh.some((w) => w.id === 'warn_safe_z_max' && w.level === 'error')).toBe(true);

    const badFeeds = analyzeProjectWarnings([], [], {
      ...baseMachine,
      feedCut: 0,
      feedPlunge: -10,
      spindleSpeed: 0,
    });
    expect(badFeeds.some((w) => w.id === 'warn_feed_cut')).toBe(true);
    expect(badFeeds.some((w) => w.id === 'warn_feed_plunge')).toBe(true);
    expect(badFeeds.some((w) => w.id === 'warn_spindle' && w.level === 'warning')).toBe(true);
  });

  it('ловит выход объектов за границы X/Y (включая вылет дуги и смещение workOffset)', () => {
    const objs: CADObject[] = [
      // Дуга с концами внутри [-1000..0], но выпуклостью за x = +20 (вне xMax = 0)
      {
        id: 'arc_bulge',
        name: 'Выступающая дуга',
        type: 'arc',
        startX: -30,
        startY: -100,
        endX: -30,
        endY: -200,
        centerX: -30,
        centerY: -150,
        radius: 50,
        clockwise: true,
        depth: 10,
        operationType: 'cut',
      },
      // Окружность внутри программных координат, но workOffset вытолкнет её за xMax = 0
      {
        id: 'c_inside',
        name: 'Круг у края',
        type: 'circle',
        centerX: -20,
        centerY: -100,
        radius: 15,
        depth: 10,
        operationType: 'cut',
      },
    ];

    const warns = analyzeProjectWarnings(objs, [], {
      ...baseMachine,
      workOffset: { x: 10, y: 0 },
    });
    expect(warns.some((w) => w.id === 'warn_bound_arc_bulge')).toBe(true);
    expect(warns.some((w) => w.id === 'warn_bound_c_inside')).toBe(true);
  });

  it('проверяет предел глубины Z (только для видимых) и диаметр отверстия против фрезы', () => {
    const objs: CADObject[] = [
      { id: 'deep_vis', name: 'Глубокий рез', type: 'line', startX: -100, startY: -100, endX: -200, endY: -100, depth: 55, operationType: 'cut' },
      { id: 'deep_hid', name: 'Скрытый глубокий', type: 'line', startX: -100, startY: -100, endX: -200, endY: -100, depth: 55, operationType: 'cut', visible: false },
      { id: 'small_hole', name: 'Малое отверстие', type: 'point', x: -150, y: -150, diameter: 3, depth: 10, drillMode: '3mm', operationType: 'drill' },
    ];

    const warns = analyzeProjectWarnings(objs, [], baseMachine);
    expect(warns.some((w) => w.id === 'warn_bound_z_deep_vis' && w.level === 'error')).toBe(true);
    expect(warns.some((w) => w.id === 'warn_bound_z_deep_hid')).toBe(false);
    expect(warns.some((w) => w.id === 'warn_tool_hole_small_hole' && w.level === 'warning')).toBe(true);
  });
});

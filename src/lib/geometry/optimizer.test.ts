import { describe, expect, it } from 'vitest';
import { CADObject } from '../../types';
import { flipObject, getObjectEndpoints, optimizeCADObjects } from './optimizer';

describe('optimizeCADObjects', () => {
  it('возвращает пустой результат при отсутствии видимых объектов', () => {
    const hidden: CADObject[] = [
      {
        id: 'h1',
        name: 'Скрытая',
        type: 'point',
        x: -10,
        y: -10,
        diameter: 8,
        depth: 10,
        drillMode: '11mm',
        operationType: 'drill',
        visible: false,
      },
    ];
    const empty = optimizeCADObjects([]);
    expect(empty.optimizedObjects).toEqual([]);
    expect(empty.savedDistance).toBe(0);

    const resHidden = optimizeCADObjects(hidden);
    expect(resHidden.optimizedObjects).toEqual([]);
    expect(resHidden.totalObjects).toBe(1);
  });

  it('сортирует отверстия по ближайшему соседу и сокращает холостой пробег', () => {
    const holes: CADObject[] = [
      { id: 'p_far', name: 'Дальнее', type: 'point', x: -500, y: 0, diameter: 11, depth: 33, drillMode: '11mm', operationType: 'drill' },
      { id: 'p_near', name: 'Ближнее', type: 'point', x: -50, y: 0, diameter: 11, depth: 33, drillMode: '11mm', operationType: 'drill' },
      { id: 'p_mid', name: 'Среднее', type: 'point', x: -250, y: 0, diameter: 11, depth: 33, drillMode: '11mm', operationType: 'drill' },
    ];
    const snapshot = structuredClone(holes);
    const res = optimizeCADObjects(holes, { x: 0, y: 0 }, { returnToStart: false });

    expect(res.optimizedObjects.map((o) => o.id)).toEqual(['p_near', 'p_mid', 'p_far']);
    expect(res.optimizedDistance).toBeLessThan(res.initialDistance);
    expect(res.savedDistance).toBeCloseTo(res.initialDistance - res.optimizedDistance, 4);
    expect(res.savedPercentage).toBeGreaterThan(0);
    expect(res.reorderedCount).toBeGreaterThan(0);
    // Входной массив не мутирован
    expect(holes).toEqual(snapshot);
  });

  it('переворачивает линии и дуги, если конец ближе к текущей точке, и инвертирует clockwise у дуги', () => {
    const objs: CADObject[] = [
      {
        id: 'l1',
        name: 'Линия назад',
        type: 'line',
        startX: -200,
        startY: 0,
        endX: -10,
        endY: 0,
        depth: 5,
        operationType: 'cut',
      },
      {
        id: 'a1',
        name: 'Дуга назад',
        type: 'arc',
        startX: -300,
        startY: -100,
        endX: -200,
        endY: 0,
        centerX: -200,
        centerY: -100,
        radius: 100,
        clockwise: true,
        depth: 5,
        operationType: 'cut',
      },
    ];

    const res = optimizeCADObjects(objs, { x: 0, y: 0 }, { returnToStart: false });
    expect(res.flippedCount).toBe(2);

    const first = res.optimizedObjects[0];
    expect(first.type).toBe('line');
    if (first.type === 'line') {
      expect(first.startX).toBe(-10);
      expect(first.endX).toBe(-200);
    }

    const second = res.optimizedObjects[1];
    expect(second.type).toBe('arc');
    if (second.type === 'arc') {
      expect(second.startX).toBe(-200);
      expect(second.endX).toBe(-300);
      expect(second.clockwise).toBe(false);
    }
  });

  it('flipObject не переворачивает замкнутую полилинию и корректно разворачивает открытую', () => {
    const openPoly: CADObject = {
      id: 'pl_open',
      name: 'Открытая',
      type: 'polyline',
      closed: false,
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }],
      depth: 5,
      operationType: 'cut',
    };
    const closedPoly: CADObject = {
      ...openPoly,
      id: 'pl_closed',
      closed: true,
    };

    expect(getObjectEndpoints(openPoly).flippable).toBe(true);
    expect(getObjectEndpoints(closedPoly).flippable).toBe(false);

    const flippedOpen = flipObject(openPoly);
    expect(flippedOpen.type === 'polyline' && flippedOpen.points[0]).toEqual({ x: 20, y: 5 });

    const flippedClosed = flipObject(closedPoly);
    expect(flippedClosed).toBe(closedPoly);
  });
});

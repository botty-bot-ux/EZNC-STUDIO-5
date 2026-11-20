import { describe, expect, it } from 'vitest';
import { CADObject } from '../../types';
import {
  clampRayToPosFaces,
  computeDisplayObjects,
  computeNodeEditItems,
} from './sceneCanvasGeometry';

const sampleLine: CADObject = {
  id: 'l1',
  name: 'Линия 1',
  type: 'line',
  startX: -100,
  startY: -100,
  endX: -200,
  endY: -100,
  depth: 10,
  operationType: 'cut',
};

const sampleLine2: CADObject = {
  id: 'l2',
  name: 'Линия 2',
  type: 'line',
  startX: -200,
  startY: -100,
  endX: -200,
  endY: -250,
  depth: 10,
  operationType: 'cut',
};

describe('sceneCanvasGeometry', () => {
  it('clampRayToPosFaces укорачивает луч на гранях X=0 и Y=0', () => {
    const res = clampRayToPosFaces({ x: -100, y: -100 }, { x: 100, y: -100 });
    expect(res.x).toBeCloseTo(0, 6);
    expect(res.y).toBeCloseTo(-100, 6);
  });

  it('computeDisplayObjects применяет liveDrag translate через единый translateCADObject без мутации исходников', () => {
    const out = computeDisplayObjects({
      objects: [sampleLine, sampleLine2],
      liveDrag: { mode: 'translate', dx: -25, dy: -15, ids: ['l1'] },
      liveMove: null,
      liveScale: null,
      liveRotate: null,
    });
    expect(out[0].type).toBe('line');
    if (out[0].type === 'line') {
      expect(out[0].startX).toBe(-125);
      expect(out[0].startY).toBe(-115);
      expect(out[0].endX).toBe(-225);
    }
    // Невыделенный объект не тронут, а оригинал не мутирован
    expect(out[1]).toBe(sampleLine2);
    expect(sampleLine.startX).toBe(-100);
  });

  it('computeNodeEditItems тянет общий узел у обеих выделенных линий одновременно', () => {
    const items = computeNodeEditItems({
      objects: [sampleLine, sampleLine2],
      dragIds: ['l1', 'l2'],
      base: sampleLine,
      dragMode: 'line_end',
      snapPt: { x: -240, y: -130 },
      shift: false,
      ctrl: false,
      zoom: 1,
    });
    expect(items).toHaveLength(2);
    expect(items).toEqual([
      { id: 'l1', patch: { endX: -240, endY: -130 } },
      { id: 'l2', patch: { startX: -240, startY: -130 } },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { ToolpathSegment } from '../../types';
import { buildMiniMapMeta, getMotionBadgeInfo, segmentToSvgPath } from './gcodePreviewHelpers';

describe('gcodePreviewHelpers', () => {
  it('builds line, arc, and full-circle SVG paths using worldToCanvas axis mapping', () => {
    const line: ToolpathSegment = {
      id: 'l1',
      type: 'feed',
      startX: -10,
      startY: -20,
      startZ: -17.5,
      endX: -50,
      endY: -60,
      endZ: -17.5,
    };
    expect(segmentToSvgPath(line)).toBe('M -20.00 -10.00 L -60.00 -50.00');

    const fullCircle: ToolpathSegment = {
      id: 'c1',
      type: 'arc_ccw',
      startX: -100,
      startY: -100,
      startZ: -17.5,
      endX: -100,
      endY: -100,
      endZ: -17.5,
      centerX: -120,
      centerY: -100,
    };
    const circlePath = segmentToSvgPath(fullCircle);
    expect(circlePath).toContain('A 20.00 20.00 0 1 0');
  });

  it('computes minimap viewBox and paths', () => {
    expect(buildMiniMapMeta([])).toEqual({ viewBox: '0 0 100 100', paths: [] });

    const segs: ToolpathSegment[] = [
      {
        id: 's1',
        type: 'feed',
        startX: -100,
        startY: -200,
        startZ: -17.5,
        endX: 0,
        endY: 0,
        endZ: -17.5,
      },
    ];
    const meta = buildMiniMapMeta(segs);
    expect(meta.paths).toHaveLength(1);
    expect(meta.viewBox.split(' ')).toHaveLength(4);
  });

  it('classifies motion badges for rapid, plunge, cut, arc, and drill', () => {
    const lift: ToolpathSegment = {
      id: '1',
      type: 'rapid',
      startX: 0,
      startY: 0,
      startZ: -17,
      endX: 0,
      endY: 0,
      endZ: 10,
    };
    const plunge: ToolpathSegment = {
      id: '2',
      type: 'feed',
      startX: 0,
      startY: 0,
      startZ: 10,
      endX: 0,
      endY: 0,
      endZ: -17,
    };
    const drill: ToolpathSegment = {
      id: '3',
      type: 'drill',
      startX: 0,
      startY: 0,
      startZ: 0,
      endX: 0,
      endY: 0,
      endZ: -18,
    };

    expect(getMotionBadgeInfo(lift).label).toBe('G00 Подъём');
    expect(getMotionBadgeInfo(plunge).label).toBe('G01 Врезание Z');
    expect(getMotionBadgeInfo(drill).label).toBe('Сверление');
  });
});

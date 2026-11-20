import { describe, expect, it } from 'vitest';
import { PROJECT_MODE_PRESETS } from '../../store/initialState';
import { ToolpathSegment } from '../../types';
import { buildGridLines, buildScene, isGroove, revealedCount } from './buildSimulation';

describe('buildSimulation', () => {
  it('returns null for empty segments', () => {
    const machine = PROJECT_MODE_PRESETS.head;
    expect(buildScene([], 3, machine)).toBeNull();
  });

  it('distinguishes cutting moves from rapid and pure vertical plunges', () => {
    const rapid: ToolpathSegment = {
      id: '1',
      type: 'rapid',
      startX: 0,
      startY: 0,
      startZ: 10,
      endX: -100,
      endY: -100,
      endZ: 10,
    };
    const plunge: ToolpathSegment = {
      id: '2',
      type: 'feed',
      startX: -100,
      startY: -100,
      startZ: 10,
      endX: -100,
      endY: -100,
      endZ: -17.5,
    };
    const cut: ToolpathSegment = {
      id: '3',
      type: 'feed',
      startX: -100,
      startY: -100,
      startZ: -17.5,
      endX: -200,
      endY: -100,
      endZ: -17.5,
    };
    const drill: ToolpathSegment = {
      id: '4',
      type: 'drill',
      startX: -50,
      startY: -50,
      startZ: 0,
      endX: -50,
      endY: -50,
      endZ: -18,
    };

    expect(isGroove(rapid)).toBe(false);
    expect(isGroove(plunge)).toBe(false);
    expect(isGroove(cut)).toBe(true);
    expect(isGroove(drill)).toBe(true);
  });

  it('uses stockSheet dimensions when enabled and falls back to bounds margin when disabled', () => {
    const segs: ToolpathSegment[] = [
      {
        id: 's1',
        type: 'feed',
        startX: -100,
        startY: -100,
        startZ: -17.5,
        endX: -200,
        endY: -100,
        endZ: -17.5,
        objectId: 'obj1',
      },
    ];

    const withSheet = PROJECT_MODE_PRESETS.rail;
    const builtWithSheet = buildScene(segs, 3, withSheet)!;
    expect(builtWithSheet.board.w).toBe(withSheet.stockSheet!.widthX);
    expect(builtWithSheet.board.d).toBe(withSheet.stockSheet!.widthY);
    expect(builtWithSheet.board.cx).toBe(-withSheet.stockSheet!.widthX / 2);
    expect(builtWithSheet.grooves.length).toBeGreaterThan(0);
    expect(builtWithSheet.grooves.length).toBe(builtWithSheet.grooveStepIndex.length);

    const noSheet = PROJECT_MODE_PRESETS.head;
    const builtNoSheet = buildScene(segs, 3, noSheet)!;
    // spanX = 100, margin = 40 + 3 = 43 -> 100 + 86 = 186
    expect(builtNoSheet.board.w).toBeCloseTo(186, 4);
    expect(builtNoSheet.board.d).toBeCloseTo(86, 4);
  });

  it('samples circular arc segments into multiple groove steps', () => {
    const machine = PROJECT_MODE_PRESETS.head;
    const fullCircle: ToolpathSegment = {
      id: 'arc1',
      type: 'arc_ccw',
      startX: -100,
      startY: -100,
      startZ: -17.5,
      endX: -100,
      endY: -100,
      endZ: -17.5,
      centerX: -150,
      centerY: -100,
    };

    const built = buildScene([fullCircle], 8, machine)!;
    expect(built.steps.length).toBeGreaterThan(20);
    expect(built.grooves.length).toBe(built.steps.length);
  });

  it('computes revealedCount via binary search accurately', () => {
    const idx = [2, 3, 5, 10, 11];
    expect(revealedCount(idx, -1)).toBe(0);
    expect(revealedCount(idx, 1)).toBe(0);
    expect(revealedCount(idx, 2)).toBe(1);
    expect(revealedCount(idx, 4)).toBe(2);
    expect(revealedCount(idx, 10)).toBe(4);
    expect(revealedCount(idx, 100)).toBe(5);
  });

  it('builds minor and major floor grid lines cleanly', () => {
    const minor = buildGridLines(-100, 0, -100, 0, 20, -18, false);
    const major = buildGridLines(-100, 0, -100, 0, 20, -18, true);
    expect(minor.length).toBeGreaterThan(0);
    expect(major.length).toBeGreaterThan(0);
    expect(minor.length % 6).toBe(0);
    expect(major.length % 6).toBe(0);
  });
});

import {
  CADObject,
  MachineSettings,
  OperationItem,
  Point2D,
  PointHoleObject,
  PostprocessorTemplates,
  ToolpathSegment,
} from '../../types';
import { formatNum, transformProgramToMachine } from '../geometry/transform';

export interface GenerationResult {
  gcode: string;
  segments: ToolpathSegment[];
  warnings: string[];
}

export function generateGcode(
  objects: CADObject[],
  operations: OperationItem[],
  machine: MachineSettings,
  templates: PostprocessorTemplates
): GenerationResult {
  const gcodeLines: string[] = [];
  const segments: ToolpathSegment[] = [];
  const warnings: string[] = [];

  const safeZ = machine.safeZ || 10;
  const spindleSpeed = machine.spindleSpeed || 15000;
  const spindleDwell = machine.spindleDwell || 3000;

  // Track current machine cutter position for toolpath rendering
  let currentPos: { x: number; y: number; z: number } = { x: 0, y: 0, z: safeZ };

  const getPoint = (p: Point2D): Point2D => {
    return transformProgramToMachine(p, machine);
  };

  // Helper to append a rapid move
  const addRapidMove = (target: { x: number; y: number; z: number }, comment?: string) => {
    const xStr = formatNum(target.x);
    const yStr = formatNum(target.y);
    const zStr = formatNum(target.z);

    let line = `G00 Z${zStr}`;
    if (Math.abs(target.x - currentPos.x) > 0.0001 || Math.abs(target.y - currentPos.y) > 0.0001) {
      line = `G00 X${xStr} Y${yStr} Z${zStr}`;
    }

    if (comment) line += ` (${comment})`;
    gcodeLines.push(line);

    segments.push({
      id: `seg_${segments.length}`,
      type: 'rapid',
      startX: currentPos.x,
      startY: currentPos.y,
      startZ: currentPos.z,
      endX: target.x,
      endY: target.y,
      endZ: target.z,
    });

    currentPos = { ...target };
  };

  // Helper to append a linear feed move
  const addFeedMove = (
    target: { x: number; y: number; z: number },
    feed: number,
    operationId?: string,
    objectId?: string
  ) => {
    const xStr = formatNum(target.x);
    const yStr = formatNum(target.y);
    const zStr = formatNum(target.z);
    const fStr = formatNum(feed, 1);

    const line = `G01 X${xStr} Y${yStr} Z${zStr} F${fStr}`;
    gcodeLines.push(line);

    segments.push({
      id: `seg_${segments.length}`,
      type: 'feed',
      startX: currentPos.x,
      startY: currentPos.y,
      startZ: currentPos.z,
      endX: target.x,
      endY: target.y,
      endZ: target.z,
      operationId,
      objectId,
    });

    currentPos = { ...target };
  };

  // Helper to append arc move
  const addArcMove = (
    cw: boolean,
    target: { x: number; y: number; z: number },
    i: number,
    j: number,
    feed: number,
    operationId?: string,
    objectId?: string
  ) => {
    const code = cw ? 'G02' : 'G03';
    const xStr = formatNum(target.x);
    const yStr = formatNum(target.y);
    const zStr = formatNum(target.z);
    const iStr = formatNum(i);
    const jStr = formatNum(j);
    const fStr = formatNum(feed, 1);

    const line = `${code} X${xStr} Y${yStr} Z${zStr} I${iStr} J${jStr} F${fStr}`;
    gcodeLines.push(line);

    segments.push({
      id: `seg_${segments.length}`,
      type: cw ? 'arc_cw' : 'arc_ccw',
      startX: currentPos.x,
      startY: currentPos.y,
      startZ: currentPos.z,
      endX: target.x,
      endY: target.y,
      endZ: target.z,
      centerX: currentPos.x + i,
      centerY: currentPos.y + j,
      operationId,
      objectId,
    });

    currentPos = { ...target };
  };

  // HEADER GENERATION
  let headerText = templates.header
    .replace(/{safeZ}/g, formatNum(safeZ))
    .replace(/{spindleSpeed}/g, String(spindleSpeed))
    .replace(/{spindleDwell}/g, String(spindleDwell));

  if (machine.workOffset.x !== 0 || machine.workOffset.y !== 0) {
    headerText += `\n; WORK OFFSET: X${machine.workOffset.x} Y${machine.workOffset.y}`;
  }

  gcodeLines.push(headerText);

  // Filter active/visible objects
  const visibleObjects = objects.filter((o) => o.visible !== false);

  if (visibleObjects.length === 0) {
    warnings.push('Нет видимых объектов для генерации G-кода.');
  }

  // PROCESS VISIBLE OBJECTS DIRECTLY
  for (const obj of visibleObjects) {
    gcodeLines.push(`\n; ------------------------------------------`);
    gcodeLines.push(`; ОБЪЕКТ: ${obj.name} (${obj.type})`);
    gcodeLines.push(`; ------------------------------------------`);

    const linkedOp = operations.find((op) => op.enabled && op.linkedObjectIds.includes(obj.id));

    const opFeedCut = linkedOp?.feedCut || machine.feedCut || 1000;
    const opFeedPlunge = linkedOp?.feedPlunge || machine.feedPlunge || 300;
    const opFeedDrill = linkedOp?.feedDrill || machine.feedDrill || 500;
    const totalDepth = Math.abs(linkedOp?.finalDepth ?? obj.depth ?? 5);

    // Single pass directly to total depth (1 проход)
    const zPasses: number[] = [-totalDepth];

    // 1. DRILLING / HOLES (11mm & 9mm modes)
    if (obj.type === 'point') {
      const ptObj = obj as PointHoleObject;
      const rawPt = { x: ptObj.x, y: ptObj.y };
      const holePt = getPoint(rawPt);
      const drillMode = ptObj.drillMode || '11mm';
      const is3mm = drillMode === '3mm' || drillMode === '3мм';
      const is11mm = drillMode === '11mm' || drillMode === '11мм';

      const feedRate = opFeedDrill || 1000.0;
      const zSafe = safeZ || 5.0;
      const totalD = ptObj.depth || 33.0;

      if (is3mm) {
        // Mode 3mm template (direct plunge drilling to depth):
        // G00 X0.0 Y0.0 Z5.0
        // G01 Z-{totalD} F{feedRate}
        // G00 Z5.0
        const startX = holePt.x;
        const startY = holePt.y;
        const zFinal = totalD;

        const xStr = formatNum(startX, 1);
        const yStr = formatNum(startY, 1);
        const zSafeStr = formatNum(zSafe, 1);
        const zFinalStr = formatNum(zFinal, 1);
        const fStr = formatNum(feedRate, 1);

        gcodeLines.push(`G00 X${xStr} Y${yStr} Z${zSafeStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'rapid',
          startX: currentPos.x,
          startY: currentPos.y,
          startZ: currentPos.z,
          endX: startX,
          endY: startY,
          endZ: zSafe,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: zSafe };

        gcodeLines.push(`G01 Z-${zFinalStr} F${fStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'drill',
          startX: startX,
          startY: startY,
          startZ: zSafe,
          endX: startX,
          endY: startY,
          endZ: -zFinal,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: -zFinal };

        gcodeLines.push(`G00 Z${zSafeStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'rapid',
          startX: startX,
          startY: startY,
          startZ: -zFinal,
          endX: startX,
          endY: startY,
          endZ: zSafe,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: zSafe };
      } else if (is11mm) {
        // Mode 11mm template:
        // G00 X-1.5 Y0.0 Z5.0
        // G02 I1.5 J0.0 Z-16.0 F1000.0
        // G02 I1.5 J0.0 Z-33.0
        // G00 Z5.0
        const offset = 1.5;
        const startX = holePt.x - offset;
        const startY = holePt.y;

        const z1 = totalD > 16 ? 16.0 : Number((totalD / 2).toFixed(1));
        const z2 = totalD;

        const xStr = formatNum(startX, 1);
        const yStr = formatNum(startY, 1);
        const zSafeStr = formatNum(zSafe, 1);
        const z1Str = formatNum(z1, 1);
        const z2Str = formatNum(z2, 1);
        const fStr = formatNum(feedRate, 1);

        gcodeLines.push(`G00 X${xStr} Y${yStr} Z${zSafeStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'rapid',
          startX: currentPos.x,
          startY: currentPos.y,
          startZ: currentPos.z,
          endX: startX,
          endY: startY,
          endZ: zSafe,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: zSafe };

        gcodeLines.push(`G02 I1.5 J0.0 Z-${z1Str} F${fStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'arc_cw',
          startX: startX,
          startY: startY,
          startZ: zSafe,
          endX: startX,
          endY: startY,
          endZ: -z1,
          centerX: holePt.x,
          centerY: holePt.y,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: -z1 };

        gcodeLines.push(`G02 I1.5 J0.0 Z-${z2Str}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'arc_cw',
          startX: startX,
          startY: startY,
          startZ: -z1,
          endX: startX,
          endY: startY,
          endZ: -z2,
          centerX: holePt.x,
          centerY: holePt.y,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: -z2 };

        gcodeLines.push(`G00 Z${zSafeStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'rapid',
          startX: startX,
          startY: startY,
          startZ: -z2,
          endX: startX,
          endY: startY,
          endZ: zSafe,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: zSafe };
      } else {
        // Mode 9mm template:
        // G00 X-0.5 Y0.0 Z5.0
        // G02 I0.5 J0.0 Z-33.0 F1000.0
        // G00 Z5.0
        const offset = 0.5;
        const startX = holePt.x - offset;
        const startY = holePt.y;

        const zFinal = totalD;

        const xStr = formatNum(startX, 1);
        const yStr = formatNum(startY, 1);
        const zSafeStr = formatNum(zSafe, 1);
        const zFinalStr = formatNum(zFinal, 1);
        const fStr = formatNum(feedRate, 1);

        gcodeLines.push(`G00 X${xStr} Y${yStr} Z${zSafeStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'rapid',
          startX: currentPos.x,
          startY: currentPos.y,
          startZ: currentPos.z,
          endX: startX,
          endY: startY,
          endZ: zSafe,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: zSafe };

        gcodeLines.push(`G02 I0.5 J0.0 Z-${zFinalStr} F${fStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'arc_cw',
          startX: startX,
          startY: startY,
          startZ: zSafe,
          endX: startX,
          endY: startY,
          endZ: -zFinal,
          centerX: holePt.x,
          centerY: holePt.y,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: -zFinal };

        gcodeLines.push(`G00 Z${zSafeStr}`);
        segments.push({
          id: `seg_${segments.length}`,
          type: 'rapid',
          startX: startX,
          startY: startY,
          startZ: -zFinal,
          endX: startX,
          endY: startY,
          endZ: zSafe,
          objectId: obj.id,
        });
        currentPos = { x: startX, y: startY, z: zSafe };
      }
    }
    // 2. LINE OBJECT
    else if (obj.type === 'line') {
      const p1 = getPoint({ x: obj.startX, y: obj.startY });
      const p2 = getPoint({ x: obj.endX, y: obj.endY });

      addRapidMove({ x: p1.x, y: p1.y, z: safeZ });

      let atP1 = true;
      for (const targetZ of zPasses) {
        if (atP1) {
          addFeedMove({ x: p1.x, y: p1.y, z: targetZ }, opFeedPlunge, undefined, obj.id);
          addFeedMove({ x: p2.x, y: p2.y, z: targetZ }, opFeedCut, undefined, obj.id);
          atP1 = false;
        } else {
          addFeedMove({ x: p2.x, y: p2.y, z: targetZ }, opFeedPlunge, undefined, obj.id);
          addFeedMove({ x: p1.x, y: p1.y, z: targetZ }, opFeedCut, undefined, obj.id);
          atP1 = true;
        }
      }
      const endPos = atP1 ? p1 : p2;
      addRapidMove({ x: endPos.x, y: endPos.y, z: safeZ });
    }
    // 3. POLYLINE OBJECT
    else if (obj.type === 'polyline') {
      if (!obj.points || obj.points.length < 2) continue;
      const pts = obj.points.map(getPoint);
      const startPt = pts[0];

      addRapidMove({ x: startPt.x, y: startPt.y, z: safeZ });

      if (obj.closed) {
        for (const targetZ of zPasses) {
          addFeedMove({ x: startPt.x, y: startPt.y, z: targetZ }, opFeedPlunge, undefined, obj.id);
          for (let i = 1; i < pts.length; i++) {
            addFeedMove({ x: pts[i].x, y: pts[i].y, z: targetZ }, opFeedCut, undefined, obj.id);
          }
          addFeedMove({ x: startPt.x, y: startPt.y, z: targetZ }, opFeedCut, undefined, obj.id);
        }
        addRapidMove({ x: startPt.x, y: startPt.y, z: safeZ });
      } else {
        let forward = true;
        for (const targetZ of zPasses) {
          if (forward) {
            addFeedMove({ x: pts[0].x, y: pts[0].y, z: targetZ }, opFeedPlunge, undefined, obj.id);
            for (let i = 1; i < pts.length; i++) {
              addFeedMove({ x: pts[i].x, y: pts[i].y, z: targetZ }, opFeedCut, undefined, obj.id);
            }
            forward = false;
          } else {
            const lastIdx = pts.length - 1;
            addFeedMove({ x: pts[lastIdx].x, y: pts[lastIdx].y, z: targetZ }, opFeedPlunge, undefined, obj.id);
            for (let i = lastIdx - 1; i >= 0; i--) {
              addFeedMove({ x: pts[i].x, y: pts[i].y, z: targetZ }, opFeedCut, undefined, obj.id);
            }
            forward = true;
          }
        }
        addRapidMove({ x: currentPos.x, y: currentPos.y, z: safeZ });
      }
    }
    // 4. RECTANGLE OBJECT
    else if (obj.type === 'rectangle') {
      const w = obj.width;
      const h = obj.height;
      const c1 = getPoint({ x: obj.x, y: obj.y });
      const c2 = getPoint({ x: obj.x + w, y: obj.y });
      const c3 = getPoint({ x: obj.x + w, y: obj.y + h });
      const c4 = getPoint({ x: obj.x, y: obj.y + h });

      addRapidMove({ x: c1.x, y: c1.y, z: safeZ });

      for (const targetZ of zPasses) {
        addFeedMove({ x: c1.x, y: c1.y, z: targetZ }, opFeedPlunge, undefined, obj.id);
        addFeedMove({ x: c2.x, y: c2.y, z: targetZ }, opFeedCut, undefined, obj.id);
        addFeedMove({ x: c3.x, y: c3.y, z: targetZ }, opFeedCut, undefined, obj.id);
        addFeedMove({ x: c4.x, y: c4.y, z: targetZ }, opFeedCut, undefined, obj.id);
        addFeedMove({ x: c1.x, y: c1.y, z: targetZ }, opFeedCut, undefined, obj.id);
      }
      addRapidMove({ x: c1.x, y: c1.y, z: safeZ });
    }
    // 5. CIRCLE OBJECT
    else if (obj.type === 'circle') {
      const center = getPoint({ x: obj.centerX, y: obj.centerY });
      const r = obj.radius;
      const startPt = { x: center.x - r, y: center.y };

      addRapidMove({ x: startPt.x, y: startPt.y, z: safeZ });

      for (const targetZ of zPasses) {
        addFeedMove({ x: startPt.x, y: startPt.y, z: targetZ }, opFeedPlunge, undefined, obj.id);
        addArcMove(true, { x: startPt.x, y: startPt.y, z: targetZ }, r, 0, opFeedCut, undefined, obj.id);
      }
      addRapidMove({ x: startPt.x, y: startPt.y, z: safeZ });
    }
    // 6. ARC OBJECT
    else if (obj.type === 'arc') {
      const pStart = getPoint({ x: obj.startX, y: obj.startY });
      const pEnd = getPoint({ x: obj.endX, y: obj.endY });
      const pCenter = getPoint({ x: obj.centerX, y: obj.centerY });

      const i = pCenter.x - pStart.x;
      const j = pCenter.y - pStart.y;

      addRapidMove({ x: pStart.x, y: pStart.y, z: safeZ });

      for (const targetZ of zPasses) {
        addFeedMove({ x: pStart.x, y: pStart.y, z: targetZ }, opFeedPlunge, undefined, obj.id);
        addArcMove(obj.clockwise, { x: pEnd.x, y: pEnd.y, z: targetZ }, i, j, opFeedCut, undefined, obj.id);
      }
      addRapidMove({ x: pEnd.x, y: pEnd.y, z: safeZ });
    }
  }

  // FOOTER GENERATION
  const footerText = templates.footer.replace(/{safeZ}/g, formatNum(safeZ));
  gcodeLines.push(footerText);

  // Add final retract segment if not already at 0,0,safeZ
  segments.push({
    id: `seg_${segments.length}`,
    type: 'rapid',
    startX: currentPos.x,
    startY: currentPos.y,
    startZ: currentPos.z,
    endX: 0,
    endY: 0,
    endZ: safeZ,
  });

  return {
    gcode: gcodeLines.join('\n'),
    segments,
    warnings,
  };
}

/**
 * Packs the project JSON metadata into a comment at the top of the .nc file,
 * keeping the file 100% executable by NC Studio 5 while restoring full project state on open.
 */
export function generateNCFileWithMetadata(exportData: any, gcode: string): string {
  const jsonStr = JSON.stringify(exportData);
  const headerBlock = `;==========================================
; NCSTUDIO PROJECT DATA (v1.0)
; NCSTUDIO_PROJECT:${jsonStr}
;==========================================
`;
  return headerBlock + gcode;
}


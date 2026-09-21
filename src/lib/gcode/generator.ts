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
import { formatObjectMarker } from './constants';

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
    const dist = Math.hypot(target.x - currentPos.x, target.y - currentPos.y, target.z - currentPos.z);
    if (dist < 0.0001) {
      return;
    }

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
    const dist = Math.hypot(target.x - currentPos.x, target.y - currentPos.y, target.z - currentPos.z);
    if (dist < 0.0001) {
      return;
    }

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

  // --- Continuous-cut helpers (avoid useless retract/plunge at shared vertices) ---
  // The cutter may be left DOWN at cut depth between two objects whose junction
  // coincides, so we don't lift (`G00 Z..`) and re-plunge (`G01 ..Z..`) in the same spot.
  const EPS_CONNECT = 0.01; // mm tolerance for "same point"
  let downZ: number | null = null; // cut depth currently cutting at, or null when at safeZ

  const ensureUp = () => {
    if (downZ !== null) {
      addRapidMove({ x: currentPos.x, y: currentPos.y, z: safeZ });
      downZ = null;
    }
  };

  // Position the cutter ready to cut at point `s` and depth `cutZ`. If we're already
  // down at `cutZ` and (nearly) at `s`, continue without lifting — a connected chain.
  const beginCutAt = (s: Point2D, cutZ: number, plungeFeed: number, objectId: string) => {
    if (
      downZ !== null &&
      downZ === cutZ &&
      Math.abs(currentPos.x - s.x) < EPS_CONNECT &&
      Math.abs(currentPos.y - s.y) < EPS_CONNECT
    ) {
      currentPos = { x: s.x, y: s.y, z: cutZ }; // snap sub-tolerance delta silently
      return;
    }
    ensureUp();
    addRapidMove({ x: s.x, y: s.y, z: safeZ });
    addFeedMove({ x: s.x, y: s.y, z: cutZ }, plungeFeed, undefined, objectId);
    downZ = cutZ;
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
    // Маркер объекта — из общего контракта constants.ts (его же читает парсер).
    gcodeLines.push(`\n${formatObjectMarker(obj.id, obj.name, obj.type)}`);

    const linkedOp = operations.find((op) => op.enabled && op.linkedObjectIds.includes(obj.id));

    const opFeedCut = machine.feedCut || linkedOp?.feedCut || 1000;
    const opFeedPlunge = machine.feedPlunge || linkedOp?.feedPlunge || 300;
    const opFeedDrill = machine.feedDrill || linkedOp?.feedDrill || 500;
    // Глубина реза = пресет листа (cutDepth), затем своя глубина фигуры, затем 5.
    // finalDepth устаревших операций НЕ перекрывает выбор листа (иначе Z не меняется при смене режима).
    const cutZ = -Math.abs(machine.cutDepth ?? obj.depth ?? 5);

    // 1. DRILLING / HOLES (11mm & 9mm modes)
    if (obj.type === 'point') {
      ensureUp(); // holes are isolated spots — always start from a lifted cutter
      const ptObj = obj as PointHoleObject;
      const rawPt = { x: ptObj.x, y: ptObj.y };
      const holePt = getPoint(rawPt);
      const drillMode = ptObj.drillMode || '11mm';
      const is3mm = drillMode === '3mm' || drillMode === '3мм';
      const is11mm = drillMode === '11mm' || drillMode === '11мм';

      const feedRate = opFeedDrill || 1000.0;
      const zSafe = safeZ || 5.0;
      const totalD = ptObj.depth || 33.0;

      // Три режима сверления имеют одну и ту же геометрию цикла: G00 к отверстию
      // (с X-смещением для дуговых режимов), одна/несколько подач на глубину и
      // G00 наружу. Различаются только смещение и «пики» (stages) — раньше это
      // было три скопированных блока по 40 строк; вывод посимвольно тот же.
      //  3mm  — погружение      G01 Z-{totalD} F{feed}
      //  11mm — 2 дуги-шага     G02 I1.5 J0.0 Z-{z1} F{feed} / G02 I1.5 J0.0 Z-{z2} (без F)
      //  9mm  — одна дуга       G02 I0.5 J0.0 Z-{totalD} F{feed}
      type DrillStage =
        | { kind: 'plunge'; depth: number }
        | { kind: 'arc'; depth: number; radius: number };

      let offset: number;
      let stages: DrillStage[];
      if (is3mm) {
        offset = 0;
        stages = [{ kind: 'plunge', depth: totalD }];
      } else if (is11mm) {
        offset = 1.5;
        const z1 = totalD > 16 ? 16.0 : Number((totalD / 2).toFixed(1));
        stages = [
          { kind: 'arc', depth: z1, radius: 1.5 },
          { kind: 'arc', depth: totalD, radius: 1.5 },
        ];
      } else {
        offset = 0.5;
        stages = [{ kind: 'arc', depth: totalD, radius: 0.5 }];
      }

      const startX = holePt.x - offset;
      const startY = holePt.y;
      const zSafeStr = formatNum(zSafe, 1);
      const fStr = formatNum(feedRate, 1);

      // Подход: G00 в точку начала цикла на безопасном Z.
      gcodeLines.push(`G00 X${formatNum(startX, 1)} Y${formatNum(startY, 1)} Z${zSafeStr}`);
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

      // Пику (погружения). F пишется только на первом проходе — как и раньше.
      stages.forEach((stage, si) => {
        const dStr = formatNum(stage.depth, 1);
        const sX = currentPos.x;
        const sY = currentPos.y;
        const sZ = currentPos.z;
        if (stage.kind === 'plunge') {
          gcodeLines.push(`G01 Z-${dStr} F${fStr}`);
          segments.push({
            id: `seg_${segments.length}`,
            type: 'drill',
            startX: sX,
            startY: sY,
            startZ: sZ,
            endX: startX,
            endY: startY,
            endZ: -stage.depth,
            objectId: obj.id,
          });
        } else {
          gcodeLines.push(
            `G02 I${formatNum(stage.radius, 1)} J0.0 Z-${dStr}${si === 0 ? ` F${fStr}` : ''}`
          );
          segments.push({
            id: `seg_${segments.length}`,
            type: 'arc_cw',
            startX: sX,
            startY: sY,
            startZ: sZ,
            endX: startX,
            endY: startY,
            endZ: -stage.depth,
            centerX: holePt.x,
            centerY: holePt.y,
            objectId: obj.id,
          });
        }
        currentPos = { x: startX, y: startY, z: -stage.depth };
      });

      // Отвод наружу.
      gcodeLines.push(`G00 Z${zSafeStr}`);
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
      downZ = null; // drilling always finishes lifted at safeZ
    }
    // 2. LINE OBJECT
    else if (obj.type === 'line') {
      const p1 = getPoint({ x: obj.startX, y: obj.startY });
      const p2 = getPoint({ x: obj.endX, y: obj.endY });

      beginCutAt(p1, cutZ, opFeedPlunge, obj.id);
      addFeedMove({ x: p2.x, y: p2.y, z: cutZ }, opFeedCut, undefined, obj.id);
    }
    // 3. POLYLINE OBJECT
    else if (obj.type === 'polyline') {
      if (!obj.points || obj.points.length < 2) continue;
      const pts = obj.points.map(getPoint);

      beginCutAt(pts[0], cutZ, opFeedPlunge, obj.id);
      for (let i = 1; i < pts.length; i++) {
        addFeedMove({ x: pts[i].x, y: pts[i].y, z: cutZ }, opFeedCut, undefined, obj.id);
      }
      if (obj.closed) {
        addFeedMove({ x: pts[0].x, y: pts[0].y, z: cutZ }, opFeedCut, undefined, obj.id);
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

      beginCutAt(c1, cutZ, opFeedPlunge, obj.id);
      addFeedMove({ x: c2.x, y: c2.y, z: cutZ }, opFeedCut, undefined, obj.id);
      addFeedMove({ x: c3.x, y: c3.y, z: cutZ }, opFeedCut, undefined, obj.id);
      addFeedMove({ x: c4.x, y: c4.y, z: cutZ }, opFeedCut, undefined, obj.id);
      addFeedMove({ x: c1.x, y: c1.y, z: cutZ }, opFeedCut, undefined, obj.id);
    }
    // 5. CIRCLE OBJECT
    else if (obj.type === 'circle') {
      const center = getPoint({ x: obj.centerX, y: obj.centerY });
      const r = obj.radius;
      const startPt = { x: center.x - r, y: center.y };

      beginCutAt(startPt, cutZ, opFeedPlunge, obj.id);
      addArcMove(true, { x: startPt.x, y: startPt.y, z: cutZ }, r, 0, opFeedCut, undefined, obj.id);
    }
    // 6. ARC OBJECT
    else if (obj.type === 'arc') {
      const pStart = getPoint({ x: obj.startX, y: obj.startY });
      const pEnd = getPoint({ x: obj.endX, y: obj.endY });
      const pCenter = getPoint({ x: obj.centerX, y: obj.centerY });

      const i = pCenter.x - pStart.x;
      const j = pCenter.y - pStart.y;

      beginCutAt(pStart, cutZ, opFeedPlunge, obj.id);
      addArcMove(obj.clockwise, { x: pEnd.x, y: pEnd.y, z: cutZ }, i, j, opFeedCut, undefined, obj.id);
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


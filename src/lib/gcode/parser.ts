import { CADObject, Point2D, ProjectData, ToolpathSegment } from '../../types';

/**
 * Extracts embedded project JSON data from an .nc file header comment block if present.
 */
export function extractProjectDataFromNC(content: string): ProjectData | null {
  if (!content) return null;

  // 1. Direct JSON check
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as ProjectData;
      if (parsed && Array.isArray(parsed.objects)) {
        return parsed;
      }
    } catch {
      // not direct JSON
    }
  }

  // 2. Embedded comment check "; NCSTUDIO_PROJECT:{...}"
  const match = content.match(/;\s*NCSTUDIO_PROJECT:\s*(\{.*\})/m);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]) as ProjectData;
      if (parsed && Array.isArray(parsed.objects)) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse embedded project JSON from .nc file', e);
    }
  }

  return null;
}

/**
 * Converts cutting paths from a raw G-code file into CAD objects (Line, Circle, Arc, Rectangle, Point, Polyline)
 * while preserving existing object identity and types if present.
 */
export function parseGcodeToCadObjects(
  gcode: string,
  existingObjects: CADObject[] = []
): (CADObject & { importedFeedCut?: number; importedFeedPlunge?: number })[] {
  if (!gcode || !gcode.trim()) return [];

  const existingById = new Map<string, CADObject>();
  const existingByName = new Map<string, CADObject>();
  for (const obj of existingObjects) {
    if (obj.id) existingById.set(obj.id, obj);
    if (obj.name) existingByName.set(obj.name.toLowerCase().trim(), obj);
  }

  const lines = gcode.split('\n');

  interface RawObjectBlock {
    meta?: {
      name?: string;
      type?: 'point' | 'line' | 'polyline' | 'rectangle' | 'circle' | 'arc';
      id?: string;
    };
    segments: ToolpathSegment[];
  }

  const blocks: RawObjectBlock[] = [];
  let currentMeta: RawObjectBlock['meta'] | undefined = undefined;
  let currentSegments: ToolpathSegment[] = [];

  let curX = 0;
  let curY = 0;
  let curZ = 10;
  let curFeed: number | undefined = undefined;
  let isAbsolute = true;
  let activeMotion: 'G0' | 'G1' | 'G2' | 'G3' | null = null;

  const pushCurrentBlock = () => {
    if (currentSegments.length > 0) {
      blocks.push({
        meta: currentMeta ? { ...currentMeta } : undefined,
        segments: [...currentSegments],
      });
      currentSegments = [];
    }
  };

  const parseHeaderLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith(';')) return null;

    const typePattern = '(point|line|polyline|rectangle|circle|arc)';

    // Compact format: ;[ID: id] name (type) OR ;[ID: id] (name) (type) OR ;[ID: id] ОБЪЕКТ: name (type)
    const compactRegex = new RegExp(`^;\\s*\\[ID:\\s*([^\\]]+)\\]\\s*(?:ОБЪЕКТ:\\s*)?(?:\\((.*?)\\)|(.*?))\\s*\\(${typePattern}\\)`, 'i');
    let match = line.match(compactRegex);
    if (match) {
      const id = match[1].trim();
      const name = (match[2] || match[3] || '').trim();
      const type = match[4].toLowerCase() as CADObject['type'];
      return { id, name, type };
    }

    // Legacy format: ; ОБЪЕКТ: name (type) [ID: id]
    const legacyRegex = new RegExp(`^;\\s*ОБЪЕКТ:\\s*(.*?)\\s*\\(${typePattern}\\)(?:\\s*\\[ID:\\s*([^\\]]+)\\])?`, 'i');
    match = line.match(legacyRegex);
    if (match) {
      const name = match[1].trim();
      const type = match[2].toLowerCase() as CADObject['type'];
      const id = match[3]?.trim();
      return { id, name, type };
    }

    return null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const headerInfo = parseHeaderLine(rawLine);

    if (headerInfo) {
      pushCurrentBlock();
      currentMeta = {
        name: headerInfo.name,
        type: headerInfo.type,
        id: headerInfo.id,
      };
      continue;
    }

    let line = rawLine.trim();
    line = line.replace(/\(.*?\)/g, '');
    const commentIdx = line.indexOf(';');
    if (commentIdx !== -1) {
      line = line.substring(0, commentIdx);
    }
    line = line.trim().toUpperCase();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    let nextX = curX;
    let nextY = curY;
    let nextZ = curZ;
    let arcI = 0;
    let arcJ = 0;
    let hasX = false;
    let hasY = false;
    let hasZ = false;

    for (const token of tokens) {
      if (token === 'G90') isAbsolute = true;
      if (token === 'G91') isAbsolute = false;

      if (token === 'G0' || token === 'G00') activeMotion = 'G0';
      if (token === 'G1' || token === 'G01') activeMotion = 'G1';
      if (token === 'G2' || token === 'G02') activeMotion = 'G2';
      if (token === 'G3' || token === 'G03') activeMotion = 'G3';

      const cmd = token[0];
      const val = parseFloat(token.substring(1));
      if (isNaN(val)) continue;

      if (cmd === 'X') {
        nextX = isAbsolute ? val : curX + val;
        hasX = true;
      } else if (cmd === 'Y') {
        nextY = isAbsolute ? val : curY + val;
        hasY = true;
      } else if (cmd === 'Z') {
        nextZ = isAbsolute ? val : curZ + val;
        hasZ = true;
      } else if (cmd === 'I') {
        arcI = val;
      } else if (cmd === 'J') {
        arcJ = val;
      } else if (cmd === 'F') {
        curFeed = val;
      }
    }

    if (hasX || hasY || hasZ) {
      if (activeMotion === 'G0') {
        currentSegments.push({
          id: `seg_${currentSegments.length}`,
          type: 'rapid',
          startX: curX,
          startY: curY,
          startZ: curZ,
          endX: nextX,
          endY: nextY,
          endZ: nextZ,
        });
      } else if (activeMotion === 'G1') {
        currentSegments.push({
          id: `seg_${currentSegments.length}`,
          type: 'feed',
          startX: curX,
          startY: curY,
          startZ: curZ,
          endX: nextX,
          endY: nextY,
          endZ: nextZ,
          feed: curFeed,
        });
      } else if (activeMotion === 'G2' || activeMotion === 'G3') {
        currentSegments.push({
          id: `seg_${currentSegments.length}`,
          type: activeMotion === 'G2' ? 'arc_cw' : 'arc_ccw',
          startX: curX,
          startY: curY,
          startZ: curZ,
          endX: nextX,
          endY: nextY,
          endZ: nextZ,
          centerX: curX + arcI,
          centerY: curY + arcJ,
          feed: curFeed,
        });
      }

      curX = nextX;
      curY = nextY;
      curZ = nextZ;
    }
  }

  pushCurrentBlock();

  if (blocks.length === 0 && currentSegments.length > 0) {
    blocks.push({ segments: currentSegments });
  }

  const result: (CADObject & { importedFeedCut?: number; importedFeedPlunge?: number })[] = [];

  const unusedExistingByType: Record<string, CADObject[]> = {
    point: [],
    line: [],
    polyline: [],
    rectangle: [],
    circle: [],
    arc: [],
  };
  for (const obj of existingObjects) {
    if (unusedExistingByType[obj.type]) {
      unusedExistingByType[obj.type].push(obj);
    }
  }

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const segs = block.segments;

    const cuttingSegs = segs.filter((s) => s.type === 'feed' || s.type === 'arc_cw' || s.type === 'arc_ccw');
    if (cuttingSegs.length === 0) continue;

    let maxDepth = 0;
    let feedCut: number | undefined;
    let feedPlunge: number | undefined;

    for (const s of cuttingSegs) {
      if (s.endZ < 0) {
        maxDepth = Math.max(maxDepth, Math.abs(s.endZ));
      }
      if (s.feed) {
        if (Math.hypot(s.endX - s.startX, s.endY - s.startY) < 0.001) {
          feedPlunge = s.feed;
        } else {
          feedCut = s.feed;
        }
      }
    }

    const depth = maxDepth || 5;

    const pts: Point2D[] = [];
    for (const s of cuttingSegs) {
      if (pts.length === 0) {
        pts.push({ x: s.startX, y: s.startY });
      }
      const last = pts[pts.length - 1];
      if (Math.hypot(s.endX - last.x, s.endY - last.y) > 0.001) {
        pts.push({ x: s.endX, y: s.endY });
      }
    }

    let matchedExisting: CADObject | undefined = undefined;

    if (block.meta?.id) {
      matchedExisting = existingById.get(block.meta.id);
    }
    if (!matchedExisting && block.meta?.name) {
      matchedExisting = existingByName.get(block.meta.name.toLowerCase().trim());
    }

    let targetType: CADObject['type'] = block.meta?.type || 'polyline';

    if (!block.meta?.type) {
      if (pts.length <= 1) {
        targetType = 'point';
      } else if (pts.length === 2) {
        targetType = 'line';
      } else {
        const hasArcs = cuttingSegs.some((s) => s.type === 'arc_cw' || s.type === 'arc_ccw');
        if (hasArcs) {
          const firstArc = cuttingSegs.find((s) => s.type === 'arc_cw' || s.type === 'arc_ccw');
          if (
            firstArc &&
            Math.hypot(firstArc.startX - firstArc.endX, firstArc.startY - firstArc.endY) < 0.01
          ) {
            targetType = 'circle';
          } else {
            targetType = 'arc';
          }
        } else if (pts.length === 5 && isRectanglePoints(pts)) {
          targetType = 'rectangle';
        } else {
          targetType = 'polyline';
        }
      }
    }

    if (!matchedExisting && unusedExistingByType[targetType]?.length > 0) {
      matchedExisting = unusedExistingByType[targetType].shift();
    }

    const objId = block.meta?.id || matchedExisting?.id || `obj_${Date.now()}_${blockIdx}`;
    const objName =
      block.meta?.name ||
      matchedExisting?.name ||
      getDefaultNameForType(targetType, result.length + 1);

    if (targetType === 'line') {
      const p1 = pts[0] || { x: 0, y: 0 };
      const p2 = pts[pts.length - 1] || { x: 100, y: 0 };
      result.push({
        ...(matchedExisting && matchedExisting.type === 'line' ? matchedExisting : {}),
        id: objId,
        name: objName,
        type: 'line',
        startX: p1.x,
        startY: p1.y,
        endX: p2.x,
        endY: p2.y,
        depth: depth,
        operationType: matchedExisting?.operationType || 'cut',
        visible: matchedExisting?.visible ?? true,
        importedFeedCut: feedCut,
        importedFeedPlunge: feedPlunge,
      });
    } else if (targetType === 'circle') {
      const arcSeg = cuttingSegs.find((s) => s.type === 'arc_cw' || s.type === 'arc_ccw');
      const centerX = arcSeg?.centerX ?? (matchedExisting?.type === 'circle' ? matchedExisting.centerX : pts[0]?.x ?? 0);
      const centerY = arcSeg?.centerY ?? (matchedExisting?.type === 'circle' ? matchedExisting.centerY : pts[0]?.y ?? 0);
      const startPt = pts[0] || { x: centerX + 10, y: centerY };
      const radius = Math.hypot(startPt.x - centerX, startPt.y - centerY) || 10;

      result.push({
        ...(matchedExisting && matchedExisting.type === 'circle' ? matchedExisting : {}),
        id: objId,
        name: objName,
        type: 'circle',
        centerX,
        centerY,
        radius,
        depth,
        operationType: matchedExisting?.operationType || 'cut',
        visible: matchedExisting?.visible ?? true,
        importedFeedCut: feedCut,
        importedFeedPlunge: feedPlunge,
      });
    } else if (targetType === 'arc') {
      const arcSeg = cuttingSegs.find((s) => s.type === 'arc_cw' || s.type === 'arc_ccw');
      const startX = pts[0]?.x ?? 0;
      const startY = pts[0]?.y ?? 0;
      const endX = pts[pts.length - 1]?.x ?? 50;
      const endY = pts[pts.length - 1]?.y ?? 50;
      const centerX = arcSeg?.centerX ?? (matchedExisting?.type === 'arc' ? matchedExisting.centerX : startX);
      const centerY = arcSeg?.centerY ?? (matchedExisting?.type === 'arc' ? matchedExisting.centerY : startY);
      const radius = Math.hypot(startX - centerX, startY - centerY) || 10;
      const clockwise = arcSeg ? arcSeg.type === 'arc_cw' : true;

      result.push({
        ...(matchedExisting && matchedExisting.type === 'arc' ? matchedExisting : {}),
        id: objId,
        name: objName,
        type: 'arc',
        startX,
        startY,
        endX,
        endY,
        centerX,
        centerY,
        radius,
        clockwise,
        depth,
        operationType: matchedExisting?.operationType || 'cut',
        visible: matchedExisting?.visible ?? true,
        importedFeedCut: feedCut,
        importedFeedPlunge: feedPlunge,
      });
    } else if (targetType === 'rectangle') {
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));

      result.push({
        ...(matchedExisting && matchedExisting.type === 'rectangle' ? matchedExisting : {}),
        id: objId,
        name: objName,
        type: 'rectangle',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        depth,
        operationType: matchedExisting?.operationType || 'cut',
        visible: matchedExisting?.visible ?? true,
        importedFeedCut: feedCut,
        importedFeedPlunge: feedPlunge,
      });
    } else if (targetType === 'point') {
      const pt = pts[0] || { x: 0, y: 0 };
      result.push({
        ...(matchedExisting && matchedExisting.type === 'point' ? matchedExisting : {}),
        id: objId,
        name: objName,
        type: 'point',
        x: pt.x,
        y: pt.y,
        diameter: matchedExisting && matchedExisting.type === 'point' ? matchedExisting.diameter : 3,
        drillMode: matchedExisting && matchedExisting.type === 'point' ? matchedExisting.drillMode : '11mm',
        depth,
        operationType: matchedExisting?.operationType || 'drill',
        visible: matchedExisting?.visible ?? true,
        importedFeedCut: feedCut,
        importedFeedPlunge: feedPlunge,
      });
    } else {
      const closed =
        pts.length > 2 &&
        Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.1;

      result.push({
        ...(matchedExisting && matchedExisting.type === 'polyline' ? matchedExisting : {}),
        id: objId,
        name: objName,
        type: 'polyline',
        points: pts.length >= 2 ? pts : [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        closed,
        depth,
        operationType: matchedExisting?.operationType || 'cut',
        visible: matchedExisting?.visible ?? true,
        importedFeedCut: feedCut,
        importedFeedPlunge: feedPlunge,
      });
    }
  }

  return result;
}

function isRectanglePoints(pts: Point2D[]): boolean {
  if (pts.length !== 5) return false;
  if (Math.hypot(pts[0].x - pts[4].x, pts[0].y - pts[4].y) > 0.01) return false;

  for (let i = 0; i < 4; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.abs(dx) > 0.01 && Math.abs(dy) > 0.01) return false;
  }
  return true;
}

function getDefaultNameForType(type: CADObject['type'], idx: number): string {
  switch (type) {
    case 'line':
      return `Отрезок ${idx}`;
    case 'circle':
      return `Окружность ${idx}`;
    case 'arc':
      return `Дуга ${idx}`;
    case 'rectangle':
      return `Прямоугольник ${idx}`;
    case 'point':
      return `Точка ${idx}`;
    case 'polyline':
    default:
      return `Контур ${idx}`;
  }
}

export function parseGcodeToSegments(gcode: string): ToolpathSegment[] {
  const segments: ToolpathSegment[] = [];
  const lines = gcode.split('\n');

  let curX = 0;
  let curY = 0;
  let curZ = 10;
  let curFeed: number | undefined = undefined;
  let isAbsolute = true;
  let activeMotion: 'G0' | 'G1' | 'G2' | 'G3' | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    let line = lines[idx].trim();
    // Strip comments in () or after ;
    line = line.replace(/\(.*?\)/g, '');
    const commentIndex = line.indexOf(';');
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex);
    }
    line = line.trim().toUpperCase();
    if (!line) continue;

    const tokens = line.split(/\s+/);

    let nextX = curX;
    let nextY = curY;
    let nextZ = curZ;
    let arcI = 0;
    let arcJ = 0;
    let hasX = false;
    let hasY = false;
    let hasZ = false;

    for (const token of tokens) {
      if (token === 'G90') isAbsolute = true;
      if (token === 'G91') isAbsolute = false;

      if (token === 'G0' || token === 'G00') activeMotion = 'G0';
      if (token === 'G1' || token === 'G01') activeMotion = 'G1';
      if (token === 'G2' || token === 'G02') activeMotion = 'G2';
      if (token === 'G3' || token === 'G03') activeMotion = 'G3';

      const cmd = token[0];
      const val = parseFloat(token.substring(1));
      if (isNaN(val)) continue;

      if (cmd === 'X') {
        nextX = isAbsolute ? val : curX + val;
        hasX = true;
      } else if (cmd === 'Y') {
        nextY = isAbsolute ? val : curY + val;
        hasY = true;
      } else if (cmd === 'Z') {
        nextZ = isAbsolute ? val : curZ + val;
        hasZ = true;
      } else if (cmd === 'I') {
        arcI = val;
      } else if (cmd === 'J') {
        arcJ = val;
      } else if (cmd === 'F') {
        curFeed = val;
      }
    }

    if (hasX || hasY || hasZ) {
      if (activeMotion === 'G0') {
        segments.push({
          id: `parse_${segments.length}`,
          type: 'rapid',
          startX: curX,
          startY: curY,
          startZ: curZ,
          endX: nextX,
          endY: nextY,
          endZ: nextZ,
        });
      } else if (activeMotion === 'G1') {
        segments.push({
          id: `parse_${segments.length}`,
          type: 'feed',
          startX: curX,
          startY: curY,
          startZ: curZ,
          endX: nextX,
          endY: nextY,
          endZ: nextZ,
          feed: curFeed,
        });
      } else if (activeMotion === 'G2' || activeMotion === 'G3') {
        segments.push({
          id: `parse_${segments.length}`,
          type: activeMotion === 'G2' ? 'arc_cw' : 'arc_ccw',
          startX: curX,
          startY: curY,
          startZ: curZ,
          endX: nextX,
          endY: nextY,
          endZ: nextZ,
          centerX: curX + arcI,
          centerY: curY + arcJ,
          feed: curFeed,
        });
      }

      curX = nextX;
      curY = nextY;
      curZ = nextZ;
    }
  }

  return segments;
}


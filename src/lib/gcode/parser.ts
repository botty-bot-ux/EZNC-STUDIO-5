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
 * Converts cutting paths from a raw G-code file into CAD Polyline/Point objects for scene editing.
 */
export function parseGcodeToCadObjects(gcode: string): CADObject[] {
  const segments = parseGcodeToSegments(gcode);
  const feedSegments = segments.filter((s) => s.type === 'feed' || s.type === 'arc_cw' || s.type === 'arc_ccw');

  if (feedSegments.length === 0) return [];

  const objects: CADObject[] = [];
  let currentPoints: Point2D[] = [];
  let currentMaxDepth = 0;

  const pushPolyline = () => {
    if (currentPoints.length >= 2) {
      objects.push({
        id: `imported_poly_${objects.length + 1}`,
        name: `Импортированный контур ${objects.length + 1}`,
        type: 'polyline',
        points: [...currentPoints],
        closed:
          currentPoints.length > 2 &&
          Math.hypot(
            currentPoints[0].x - currentPoints[currentPoints.length - 1].x,
            currentPoints[0].y - currentPoints[currentPoints.length - 1].y
          ) < 0.1,
        depth: Math.abs(currentMaxDepth) || 5,
        operationType: 'cut',
        visible: true,
      });
    }
    currentPoints = [];
    currentMaxDepth = 0;
  };

  for (const seg of feedSegments) {
    if (seg.endZ < 0) {
      currentMaxDepth = Math.max(currentMaxDepth, Math.abs(seg.endZ));
    }

    if (currentPoints.length === 0) {
      currentPoints.push({ x: seg.startX, y: seg.startY });
    } else {
      const lastPt = currentPoints[currentPoints.length - 1];
      if (Math.hypot(lastPt.x - seg.startX, lastPt.y - seg.startY) > 0.1) {
        pushPolyline();
        currentPoints.push({ x: seg.startX, y: seg.startY });
      }
    }
    currentPoints.push({ x: seg.endX, y: seg.endY });
  }

  pushPolyline();

  return objects;
}

export function parseGcodeToSegments(gcode: string): ToolpathSegment[] {
  const segments: ToolpathSegment[] = [];
  const lines = gcode.split('\n');

  let curX = 0;
  let curY = 0;
  let curZ = 10;
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
        });
      }

      curX = nextX;
      curY = nextY;
      curZ = nextZ;
    }
  }

  return segments;
}


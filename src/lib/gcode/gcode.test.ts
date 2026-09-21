import { describe, expect, it } from 'vitest';
import { CADObject, MachineSettings, PostprocessorTemplates } from '../../types';
import { generateGcode } from './generator';
import {
  extractProjectDataFromNC,
  parseGcodeToCadObjects,
  parseGcodeToSegments,
} from './parser';
import { OBJECT_MARKER_LINE_RE, formatObjectMarker } from './constants';

/**
 *страховка контракта generator ↔ parser. Парсер и генератор говорят на одном
 * диалекте (маркеры объектов, I/J дуг, модальные G0/G1/G90/G91) — любые правки
 * одной стороны должны проходить round-trip, иначе импорт собственного G-кода
 * молча испортится.
 */

const machine: MachineSettings = {
  units: 'mm',
  controllerProfile: 'ncstudio',
  bounds: { xMin: 0, xMax: 3000, yMin: 0, yMax: 2000 },
  workOffset: { x: 0, y: 0 },
  safeZ: 5,
  spindleSpeed: 15000,
  spindleDwell: 3000,
  feedCut: 1200,
  feedPlunge: 300,
  feedDrill: 500,
  toolDiameter: 8,
  toolName: 'Фреза',
  useCannedCycles: false,
};

const templates: PostprocessorTemplates = {
  header: 'G21\nG90\nG00 Z{safeZ}',
  footer: 'M05\nM30',
  toolChange: '',
  spindleStart: '',
  spindleStop: '',
};

const mkObj = (o: CADObject): CADObject => o;

const shapes: CADObject[] = [
  mkObj({ id: 'l1', name: 'Линия', type: 'line', startX: 0, startY: 0, endX: 100.5, endY: 20.25, depth: 8, operationType: 'cut' }),
  mkObj({ id: 'r1', name: 'Прямоугольник', type: 'rectangle', x: 200, y: 100, width: 150, height: 75, depth: 10, operationType: 'cut' }),
  mkObj({ id: 'c1', name: 'Круг', type: 'circle', centerX: 500, centerY: 300, radius: 42.5, depth: 16, operationType: 'cut' }),
  mkObj({ id: 'a1', name: 'Дуга', type: 'arc', startX: 700, startY: 100, endX: 800, endY: 200, centerX: 700, centerY: 200, radius: 100, clockwise: false, depth: 5, operationType: 'cut' }),
  mkObj({ id: 'pl1', name: 'Открытая', type: 'polyline', closed: false, points: [{ x: 50, y: 50 }, { x: 60, y: 55 }, { x: 70, y: 50 }], depth: 6, operationType: 'cut' }),
  mkObj({ id: 'p3', name: 'Отверстие 3мм', type: 'point', x: 1500, y: 400, diameter: 3, drillMode: '3mm', depth: 20, operationType: 'drill' }),
  mkObj({ id: 'p9', name: 'Отверстие 9мм', type: 'point', x: 1400, y: 400, diameter: 6, drillMode: '9mm', depth: 33, operationType: 'drill' }),
  mkObj({ id: 'p11', name: 'Отверстие 11мм', type: 'point', x: 1200, y: 400, diameter: 8, drillMode: '11mm', depth: 33, operationType: 'drill' }),
];

/** Строки G-кода одного объекта (между его маркером и следующим маркером/концом). */
function linesForObject(gcode: string, id: string): string[] {
  const lines = gcode.split('\n');
  const start = lines.findIndex((l) => l.includes(`[ID: ${id}]`));
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (OBJECT_MARKER_LINE_RE.test(lines[i])) break;
    if (lines[i].trim()) out.push(lines[i]);
  }
  return out;
}

describe('контракт маркеров объектов', () => {
  it('генератор пишет, парсер читает маркер каждого объекта', () => {
    const { gcode } = generateGcode(shapes, [], machine, templates);
    for (const obj of shapes) {
      expect(gcode).toContain(formatObjectMarker(obj.id, obj.name, obj.type));
    }
    const parsed = parseGcodeToCadObjects(gcode);
    expect(parsed.map((o) => o.id)).toEqual(shapes.map((o) => o.id));
    expect(parsed.map((o) => o.type)).toEqual(shapes.map((o) => o.type));
  });
});

describe('round-trip генерация → импорт (со своим станком по умолчанию)', () => {
  const parsed = parseGcodeToCadObjects(generateGcode(shapes, [], machine, templates).gcode);
  const byId = Object.fromEntries(parsed.map((o) => [o.id, o]));

  it('линия сохраняет концы и глубину', () => {
    const l = byId.l1;
    expect(l.type).toBe('line');
    if (l.type === 'line') {
      expect(l.startX).toBeCloseTo(0, 3);
      expect(l.startY).toBeCloseTo(0, 3);
      expect(l.endX).toBeCloseTo(100.5, 3);
      expect(l.endY).toBeCloseTo(20.25, 3);
    }
    expect(l.depth).toBeCloseTo(8, 3);
  });

  it('прямоугольник сохраняет угол и размеры', () => {
    const r = byId.r1;
    expect(r.type).toBe('rectangle');
    if (r.type === 'rectangle') {
      expect(r.x).toBeCloseTo(200, 3);
      expect(r.y).toBeCloseTo(100, 3);
      expect(r.width).toBeCloseTo(150, 3);
      expect(r.height).toBeCloseTo(75, 3);
    }
  });

  it('окружность сохраняет центр и радиус (замкнутая дуга)', () => {
    const c = byId.c1;
    expect(c.type).toBe('circle');
    if (c.type === 'circle') {
      expect(c.centerX).toBeCloseTo(500, 3);
      expect(c.centerY).toBeCloseTo(300, 3);
      expect(c.radius).toBeCloseTo(42.5, 3);
    }
  });

  it('дуга ccw сохраняет концы, центр и направление', () => {
    const a = byId.a1;
    expect(a.type).toBe('arc');
    if (a.type === 'arc') {
      expect(a.startX).toBeCloseTo(700, 3);
      expect(a.endX).toBeCloseTo(800, 3);
      expect(a.endY).toBeCloseTo(200, 3);
      expect(a.centerX).toBeCloseTo(700, 3);
      expect(a.centerY).toBeCloseTo(200, 3);
      expect(a.clockwise).toBe(false);
    }
  });

  it('открытая полилиния остаётся незамкнутой', () => {
    const p = byId.pl1;
    expect(p.type).toBe('polyline');
    if (p.type === 'polyline') {
      expect(p.closed).toBe(false);
      expect(p.points).toHaveLength(3);
    }
  });

  it('3мм-отверстие возвращается в центр отверстия', () => {
    const p = byId.p3;
    expect(p.type).toBe('point');
    if (p.type === 'point') {
      expect(p.x).toBeCloseTo(1500, 3);
      expect(p.y).toBeCloseTo(400, 3);
      expect(p.depth).toBeCloseTo(20, 3);
    }
  });

  // Известное отступление (существовало до рефакторинга): дуговые режимы 11/9мм
  // начинаются с X-смещения, и при импорте точка возвращается в НАЧАЛО цикла
  // (holeX − 1.5 / − 0.5), т.к. первый режущий сегмент стартует оттуда.
  it('11мм-отверстие: тип и глубина сохраняются, координата = старт цикла (−1.5)', () => {
    const p = byId.p11;
    expect(p.type).toBe('point');
    if (p.type === 'point') {
      expect(p.x).toBeCloseTo(1198.5, 3);
      expect(p.y).toBeCloseTo(400, 3);
      expect(p.depth).toBeCloseTo(33, 3);
    }
  });
});

describe('золотые циклы сверления (вывод посимвольно)', () => {
  const { gcode } = generateGcode(shapes, [], machine, templates);

  it('11мм: подход с −1.5, два G02-пика, F только на первом', () => {
    const lines = linesForObject(gcode, 'p11');
    expect(lines).toContain('G00 X1198.5 Y400.0 Z5.0');
    expect(lines).toContain('G02 I1.5 J0.0 Z-16.0 F500.0');
    expect(lines).toContain('G02 I1.5 J0.0 Z-33.0');
    expect(lines.filter((l) => l === 'G00 Z5.0')).toHaveLength(1);
  });

  it('9мм: подход с −0.5, один G02', () => {
    const lines = linesForObject(gcode, 'p9');
    expect(lines).toContain('G00 X1399.5 Y400.0 Z5.0');
    expect(lines).toContain('G02 I0.5 J0.0 Z-33.0 F500.0');
    expect(lines).toContain('G00 Z5.0');
  });

  it('3мм: прямое погружение G01', () => {
    const lines = linesForObject(gcode, 'p3');
    expect(lines).toContain('G00 X1500.0 Y400.0 Z5.0');
    expect(lines).toContain('G01 Z-20.0 F500.0');
  });
});

describe('парсер стороннего G-кода', () => {
  it('сегменты: модальные G01/G02, двузначные коды, липкая подача, G91', () => {
    const segs = parseGcodeToSegments(
      ['G00 X0 Y0 Z5', 'G01 X10 Y0 F1200', 'G01 X20', 'G02 X25 Y5 I0 J0 F600', 'G91', 'G01 X5 Y0'].join('\n')
    );
    expect(segs.map((s) => s.type)).toEqual(['rapid', 'feed', 'feed', 'arc_cw', 'feed']);
    expect(segs[2].feed).toBe(1200); // подача наследуется модально
    expect(segs[3].centerX).toBe(20); // I/J от точки старта дуги
    expect(segs[3].centerY).toBe(0);
    expect(segs[4].endX).toBe(30); // G91: +5 от X25
    expect(segs[4].feed).toBe(600);
  });

  it('чистый .nc без маркеров: G00 со смещением XY начинает новый контур', () => {
    const square = (x: number) =>
      [`G00 X${x} Y0 Z5`, 'G01 Z-5 F300', `G01 X${x + 10} F1200`, 'G01 Y10', `G01 X${x}`, 'G01 Y0', 'G00 Z5'].join('\n');
    const objects = parseGcodeToCadObjects([square(0), square(100), 'M30'].join('\n'));
    expect(objects).toHaveLength(2);
    for (const [i, o] of objects.entries()) {
      // замкнутый ось-выровненный квадрат эвристик распознаёт как rectangle
      expect(o.type).toBe('rectangle');
      if (o.type === 'rectangle') {
        expect(o.x).toBeCloseTo(i === 0 ? 0 : 100, 3);
        expect(o.width).toBeCloseTo(10, 3);
        expect(o.height).toBeCloseTo(10, 3);
      }
    }
  });

  it('legacy-заголовок «; ОБЪЕКТ: имя (тип) [ID: x]» распознаётся с id', () => {
    const objects = parseGcodeToCadObjects(
      ['; ОБЪЕКТ: Мой круг (circle) [ID: abc1]', 'G00 X95.5 Y295 Z5', 'G01 Z-5 F300', 'G02 I4.5 J0 Z-5 F1200', 'G00 Z5'].join('\n')
    );
    expect(objects).toHaveLength(1);
    expect(objects[0].id).toBe('abc1');
    expect(objects[0].name).toBe('Мой круг');
    expect(objects[0].type).toBe('circle');
    if (objects[0].type === 'circle') {
      expect(objects[0].centerX).toBeCloseTo(100, 3);
      expect(objects[0].radius).toBeCloseTo(4.5, 3);
    }
  });
});

describe('extractProjectDataFromNC', () => {
  it('встроенный JSON по тегу и прямые JSON-файлы', () => {
    const project = { version: '1.0', name: 'P', machine, objects: [shapes[0]], operations: [], postprocessorTemplates: templates };
    expect(extractProjectDataFromNC('; что-то\n; NCSTUDIO_PROJECT:' + JSON.stringify(project))?.name).toBe('P');
    expect(extractProjectDataFromNC(JSON.stringify(project))?.name).toBe('P');
    expect(extractProjectDataFromNC('; NCSTUDIO_PROJECT:{сломан')).toBeNull();
    expect(extractProjectDataFromNC('G0 X0')).toBeNull();
  });
});

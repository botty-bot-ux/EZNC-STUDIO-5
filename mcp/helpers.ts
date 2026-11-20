import fs from 'node:fs';
import path from 'node:path';
import type {
  ArcObject,
  CADObject,
  CircleObject,
  DrillMode,
  LineObject,
  MachineSettings,
  NewCADObjectInput,
  Point2D,
  PointHoleObject,
  PolylineObject,
  PostprocessorTemplates,
  ProjectData,
  RectangleObject,
  StockAlignMode,
  ToolpathSegment,
} from '../src/types/index.ts';
import { INITIAL_MACHINE, PROJECT_MODE_PRESETS, type ProjectMode } from '../src/store/initialState.ts';
import { DEFAULT_TEMPLATES } from '../src/lib/postprocessor/templates.ts';
import { PROJECT_JSON_TAG } from '../src/lib/gcode/constants.ts';
import { generateGcode } from '../src/lib/gcode/generator.ts';
import {
  extractProjectDataFromNC,
  parseGcodeToCadObjects,
  parseGcodeToSegments,
} from '../src/lib/gcode/parser.ts';
import { computeToolpathStats, formatDistanceRu, formatDurationRu } from '../src/lib/gcode/stats.ts';
import { analyzeProjectWarnings } from '../src/lib/utils/warnings.ts';
import { analyzeTrajectoryBounds, normalizeMachineBounds } from '../src/lib/geometry/bounds.ts';
import {
  computeObjectsBounds,
  mirrorCADObject,
  rotateCADObject,
  scaleCADObject,
  translateCADObject,
} from '../src/lib/geometry/transform.ts';
import {
  computeStockAlignmentDelta,
  computeTwoLineFillet,
  joinSelectedContours,
} from '../src/lib/geometry/cadOps.ts';
import { getArcFrom3Points, getArcFromBulge } from '../src/components/canvas/canvasUtils.ts';
import { createObjectId } from '../src/lib/utils/id.ts';

// ---------------------------------------------------------------------------
// Структурированные коды ошибок (чтобы агент мог ветвиться по code)
// ---------------------------------------------------------------------------

export type McpErrorCode =
  | 'E_BAD_SOURCE'
  | 'E_FILE_NOT_FOUND'
  | 'E_NO_OBJECTS'
  | 'E_OBJECT_NOT_FOUND'
  | 'E_OUT_OF_BOUNDS'
  | 'E_INVALID_GEOMETRY'
  | 'E_FILLET_FAILED'
  | 'E_PATH_FORBIDDEN'
  | 'E_INVALID_INPUT';

export class McpToolError extends Error {
  readonly code: McpErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: McpErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Безопасность путей (опциональная песочница через EZNC_OUT_DIR)
// ---------------------------------------------------------------------------

export function resolveSafeOutPath(outPath: string, sandboxRoot = process.env.EZNC_OUT_DIR): string {
  const resolved = path.resolve(outPath);
  if (sandboxRoot && sandboxRoot.trim().length > 0) {
    const allowedRoot = path.resolve(sandboxRoot);
    const rel = path.relative(allowedRoot, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new McpToolError(
        'E_PATH_FORBIDDEN',
        `Запись за пределы разрешённой директории EZNC_OUT_DIR (${allowedRoot}) запрещена`,
        { outPath: resolved, allowedRoot }
      );
    }
  }
  return resolved;
}

export function writeTextSafe(outPath: string, text: string, sandboxRoot = process.env.EZNC_OUT_DIR): string {
  const safePath = resolveSafeOutPath(outPath, sandboxRoot);
  fs.mkdirSync(path.dirname(safePath), { recursive: true });
  fs.writeFileSync(safePath, text, 'utf8');
  return safePath;
}

// ---------------------------------------------------------------------------
// Нормализация и сборка CAD-объектов (включая arc_3pt / arc_bulge и useOwnDepth)
// ---------------------------------------------------------------------------

export interface Arc3PtShorthand {
  id?: string;
  name?: string;
  type: 'arc_3pt';
  start: Point2D;
  through: Point2D;
  end: Point2D;
  depth?: number;
  useOwnDepth?: boolean;
  color?: string;
  visible?: boolean;
  frozen?: boolean;
}

export interface ArcBulgeShorthand {
  id?: string;
  name?: string;
  type: 'arc_bulge';
  start: Point2D;
  end: Point2D;
  apex: Point2D;
  depth?: number;
  useOwnDepth?: boolean;
  color?: string;
  visible?: boolean;
  frozen?: boolean;
}

export type McpObjectInput =
  | (Partial<CADObject> & { type: CADObject['type'] })
  | Arc3PtShorthand
  | ArcBulgeShorthand;

function resolveDepthFlags(
  rawDepth: number | undefined,
  rawUseOwnDepth: boolean | undefined,
  machine: MachineSettings
): { depth: number; useOwnDepth?: boolean } {
  const fallback = machine.cutDepth ?? 17.5;
  if (rawDepth === undefined) {
    return rawUseOwnDepth !== undefined ? { depth: fallback, useOwnDepth: rawUseOwnDepth } : { depth: fallback };
  }
  const absDepth = Math.abs(rawDepth);
  if (rawUseOwnDepth !== undefined) {
    return { depth: absDepth, useOwnDepth: rawUseOwnDepth };
  }
  // Если агент явно задал глубину, отличающуюся от глобального cutDepth листа (например, паз 4 мм при листе 17.5 мм),
  // автоматически включаем useOwnDepth, чтобы генератор не перезаписал её глобальной глубиной.
  if (machine.cutDepth !== undefined && Math.abs(absDepth - Math.abs(machine.cutDepth)) > 0.01) {
    return { depth: absDepth, useOwnDepth: true };
  }
  return { depth: absDepth };
}

export function normalizeMcpObject(
  input: McpObjectInput,
  machine: MachineSettings,
  indexHint = 1
): CADObject {
  const id = input.id && input.id.trim().length > 0 ? input.id.trim() : createObjectId('obj');
  const { depth, useOwnDepth } = resolveDepthFlags(input.depth, input.useOwnDepth, machine);
  const baseMeta = {
    id,
    depth,
    ...(useOwnDepth !== undefined ? { useOwnDepth } : {}),
    ...(input.color ? { color: input.color } : {}),
    ...(input.visible !== undefined ? { visible: input.visible } : {}),
    ...(input.frozen !== undefined ? { frozen: input.frozen } : {}),
  };

  if (input.type === 'arc_3pt') {
    const geom = getArcFrom3Points(input.start, input.through, input.end);
    const arc: ArcObject = {
      ...baseMeta,
      name: input.name || `Дуга ${indexHint}`,
      type: 'arc',
      operationType: 'cut',
      startX: input.start.x,
      startY: input.start.y,
      endX: input.end.x,
      endY: input.end.y,
      centerX: geom.centerX,
      centerY: geom.centerY,
      radius: geom.radius,
      clockwise: geom.clockwise,
    };
    return arc;
  }

  if (input.type === 'arc_bulge') {
    const geom = getArcFromBulge(input.start, input.end, input.apex);
    if (!geom) {
      throw new McpToolError(
        'E_INVALID_GEOMETRY',
        `Вырожденная дуга arc_bulge (${input.name ?? id}): начало и конец совпадают`
      );
    }
    const arc: ArcObject = {
      ...baseMeta,
      name: input.name || `Дуга ${indexHint}`,
      type: 'arc',
      operationType: 'cut',
      startX: input.start.x,
      startY: input.start.y,
      endX: input.end.x,
      endY: input.end.y,
      centerX: geom.centerX,
      centerY: geom.centerY,
      radius: geom.radius,
      clockwise: geom.clockwise,
    };
    return arc;
  }

  if (input.type === 'point') {
    const p = input as Partial<PointHoleObject>;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') {
      throw new McpToolError('E_INVALID_GEOMETRY', `Отверстию (${id}) требуются числовые x и y`);
    }
    const drillMode: DrillMode = p.drillMode ?? (machine.toolDiameter >= 5 ? '11mm' : '3mm');
    return {
      ...baseMeta,
      name: p.name || `Отверстие ${indexHint}`,
      type: 'point',
      x: p.x,
      y: p.y,
      diameter: p.diameter ?? (drillMode.startsWith('11') ? 11 : drillMode.startsWith('9') ? 9 : 3),
      drillMode,
      operationType: p.operationType ?? 'drill',
      ...(p.peckDepth !== undefined ? { peckDepth: p.peckDepth } : {}),
    };
  }

  if (input.type === 'line') {
    const l = input as Partial<LineObject>;
    if (
      typeof l.startX !== 'number' ||
      typeof l.startY !== 'number' ||
      typeof l.endX !== 'number' ||
      typeof l.endY !== 'number'
    ) {
      throw new McpToolError('E_INVALID_GEOMETRY', `Линии (${id}) требуются startX, startY, endX, endY`);
    }
    return {
      ...baseMeta,
      name: l.name || `Линия ${indexHint}`,
      type: 'line',
      startX: l.startX,
      startY: l.startY,
      endX: l.endX,
      endY: l.endY,
      operationType: l.operationType ?? 'cut',
    };
  }

  if (input.type === 'polyline') {
    const pl = input as Partial<PolylineObject>;
    if (!Array.isArray(pl.points) || pl.points.length < 2) {
      throw new McpToolError('E_INVALID_GEOMETRY', `Полилинии (${id}) нужно минимум 2 точки`);
    }
    return {
      ...baseMeta,
      name: pl.name || `${pl.closed ? 'Контур' : 'Полилиния'} ${indexHint}`,
      type: 'polyline',
      points: pl.points.map((pt) => ({ x: pt.x, y: pt.y })),
      closed: Boolean(pl.closed),
      operationType: pl.operationType ?? 'cut',
    };
  }

  if (input.type === 'rectangle') {
    const r = input as Partial<RectangleObject>;
    if (
      typeof r.x !== 'number' ||
      typeof r.y !== 'number' ||
      typeof r.width !== 'number' ||
      typeof r.height !== 'number'
    ) {
      throw new McpToolError('E_INVALID_GEOMETRY', `Прямоугольнику (${id}) требуются x, y, width, height`);
    }
    return {
      ...baseMeta,
      name: r.name || `Прямоугольник ${indexHint}`,
      type: 'rectangle',
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      ...(r.cornerRadius !== undefined ? { cornerRadius: r.cornerRadius } : {}),
      operationType: r.operationType ?? 'cut',
    };
  }

  if (input.type === 'circle') {
    const c = input as Partial<CircleObject>;
    if (typeof c.centerX !== 'number' || typeof c.centerY !== 'number' || !(typeof c.radius === 'number' && c.radius > 0)) {
      throw new McpToolError('E_INVALID_GEOMETRY', `Окружности (${id}) требуются centerX, centerY и radius > 0`);
    }
    return {
      ...baseMeta,
      name: c.name || `Окружность ${indexHint}`,
      type: 'circle',
      centerX: c.centerX,
      centerY: c.centerY,
      radius: c.radius,
      operationType: c.operationType ?? 'cut',
    };
  }

  if (input.type === 'arc') {
    const a = input as Partial<ArcObject>;
    if (
      typeof a.startX !== 'number' ||
      typeof a.startY !== 'number' ||
      typeof a.endX !== 'number' ||
      typeof a.endY !== 'number' ||
      typeof a.centerX !== 'number' ||
      typeof a.centerY !== 'number'
    ) {
      throw new McpToolError(
        'E_INVALID_GEOMETRY',
        `Дуге (${id}) требуются startX, startY, endX, endY, centerX, centerY (или используйте type: 'arc_3pt' / 'arc_bulge')`
      );
    }
    const computedR = Math.hypot(a.startX - a.centerX, a.startY - a.centerY);
    const radius = typeof a.radius === 'number' && a.radius > 0 ? a.radius : computedR;
    if (!(radius > 0)) {
      throw new McpToolError('E_INVALID_GEOMETRY', `Нулевой радиус дуги (${id})`);
    }
    return {
      ...baseMeta,
      name: a.name || `Дуга ${indexHint}`,
      type: 'arc',
      startX: a.startX,
      startY: a.startY,
      endX: a.endX,
      endY: a.endY,
      centerX: a.centerX,
      centerY: a.centerY,
      radius,
      clockwise: Boolean(a.clockwise),
      operationType: a.operationType ?? 'cut',
    };
  }

  throw new McpToolError('E_INVALID_INPUT', `Неизвестный тип объекта: ${String((input as { type?: unknown }).type)}`);
}

// ---------------------------------------------------------------------------
// Создание, загрузка, сохранение и патчинг проектов
// ---------------------------------------------------------------------------

export interface CreateProjectParams {
  name?: string;
  mode?: ProjectMode;
  sheetWidthY?: number;
  sheetHeightX?: number;
  enableStockSheet?: boolean;
  cutDepth?: number | null;
  machineOverrides?: Partial<MachineSettings>;
  objects?: McpObjectInput[];
}

export function createNewProject(params: CreateProjectParams = {}): ProjectData {
  const mode: ProjectMode = params.mode ?? 'head';
  const baseMachine: MachineSettings = structuredClone(PROJECT_MODE_PRESETS[mode] ?? INITIAL_MACHINE);

  const sheetWidthY = params.sheetWidthY ?? baseMachine.stockSheet?.widthY ?? 1681;
  const sheetHeightX = params.sheetHeightX ?? baseMachine.stockSheet?.widthX ?? 1081;
  const enableStockSheet =
    params.enableStockSheet ??
    (params.sheetWidthY !== undefined || params.sheetHeightX !== undefined || mode === 'rail');

  baseMachine.stockSheet = {
    enabled: enableStockSheet,
    preset: enableStockSheet ? 'custom' : 'none',
    widthX: sheetHeightX,
    widthY: sheetWidthY,
    color: baseMachine.stockSheet?.color ?? '#22c55e',
  };

  if (params.cutDepth === null) {
    delete baseMachine.cutDepth;
  } else if (typeof params.cutDepth === 'number') {
    baseMachine.cutDepth = Math.abs(params.cutDepth);
  }

  const machine: MachineSettings = params.machineOverrides
    ? {
        ...baseMachine,
        ...params.machineOverrides,
        bounds: { ...baseMachine.bounds, ...(params.machineOverrides.bounds ?? {}) },
        workOffset: { ...baseMachine.workOffset, ...(params.machineOverrides.workOffset ?? {}) },
        stockSheet: params.machineOverrides.stockSheet
          ? { ...baseMachine.stockSheet, ...params.machineOverrides.stockSheet }
          : baseMachine.stockSheet,
      }
    : baseMachine;

  const objects = (params.objects ?? []).map((raw, idx) => normalizeMcpObject(raw, machine, idx + 1));

  return {
    version: '1.0',
    name: params.name?.trim() || (mode === 'rail' ? 'Царга' : 'Изголовье'),
    machine,
    objects,
    operations: [],
    postprocessorTemplates: structuredClone(DEFAULT_TEMPLATES),
  };
}

export interface ProjectInputRef {
  file_path?: string;
  content?: string;
  project?: ProjectData;
  /** Legacy-совместимость: автоопределение путь vs inline JSON/G-код. */
  source?: string;
}

export interface LoadedProject {
  project: ProjectData;
  format: 'json' | 'nc_embedded' | 'nc_parsed' | 'object' | 'session';
  filePath?: string;
}

function normalizeLoadedProject(raw: Partial<ProjectData>, fallbackName = 'Проект'): ProjectData {
  const base = structuredClone(INITIAL_MACHINE);
  const rawMachine = (raw.machine ?? {}) as Partial<MachineSettings>;
  // Сохраняем явный cutDepth: null / undefined как отсутствие глобального перекрытия
  const machine: MachineSettings = {
    ...base,
    ...rawMachine,
    bounds: { ...base.bounds, ...(rawMachine.bounds ?? {}) },
    workOffset: { ...base.workOffset, ...(rawMachine.workOffset ?? {}) },
    stockSheet: rawMachine.stockSheet ? { ...base.stockSheet!, ...rawMachine.stockSheet } : base.stockSheet,
  };
  if ('cutDepth' in rawMachine && rawMachine.cutDepth === null) {
    delete machine.cutDepth;
  }

  const templates: PostprocessorTemplates = {
    ...DEFAULT_TEMPLATES,
    ...(raw.postprocessorTemplates ?? {}),
  };

  return {
    version: raw.version || '1.0',
    name: raw.name || fallbackName,
    machine,
    objects: Array.isArray(raw.objects) ? raw.objects : [],
    operations: Array.isArray(raw.operations) ? raw.operations : [],
    postprocessorTemplates: templates,
  };
}

export function parseProjectContent(text: string, fallbackName = 'Проект'): LoadedProject {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new McpToolError('E_BAD_SOURCE', 'Пустое содержимое проекта/G-кода');
  }

  // 1. Чистый JSON проекта
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<ProjectData>;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.objects)) {
        throw new McpToolError('E_BAD_SOURCE', 'JSON не содержит массив objects формата EZNC ProjectData');
      }
      return { project: normalizeLoadedProject(parsed, fallbackName), format: 'json' };
    } catch (err) {
      if (err instanceof McpToolError) throw err;
      throw new McpToolError('E_BAD_SOURCE', `Невалидный JSON проекта: ${(err as Error).message}`);
    }
  }

  // 2. Встроенный JSON внутри .nc (; NCSTUDIO_PROJECT:{...})
  const embedded = extractProjectDataFromNC(text);
  if (embedded) {
    return { project: normalizeLoadedProject(embedded, fallbackName), format: 'nc_embedded' };
  }

  // 3. Сырой G-код → парсинг геометрии
  const objects = parseGcodeToCadObjects(text);
  if (objects.length === 0) {
    throw new McpToolError('E_NO_OBJECTS', 'Не удалось извлечь ни одной CAD-фигуры из G-кода');
  }
  const machine = structuredClone(INITIAL_MACHINE);
  // У импортированного стороннего G-кода глубины принадлежат самим фигурам
  delete machine.cutDepth;
  return {
    project: {
      version: '1.0',
      name: fallbackName,
      machine,
      objects,
      operations: [],
      postprocessorTemplates: structuredClone(DEFAULT_TEMPLATES),
    },
    format: 'nc_parsed',
  };
}

function looksLikeInlineContent(source: string): boolean {
  const t = source.trim();
  if (t.includes('\n') || t.includes('\r')) return true;
  if (t.startsWith('{') || t.startsWith(';') || /^G0?[0123]\b/i.test(t)) return true;
  return false;
}

export function loadProjectInput(
  input: ProjectInputRef,
  sessionState?: { project: ProjectData | null; filePath?: string }
): LoadedProject {
  if (input.project) {
    return {
      project: normalizeLoadedProject(input.project),
      format: 'object',
      filePath: input.file_path,
    };
  }

  if (input.content !== undefined) {
    return parseProjectContent(input.content);
  }

  if (input.file_path) {
    const resolved = path.resolve(input.file_path);
    if (!fs.existsSync(resolved)) {
      throw new McpToolError('E_FILE_NOT_FOUND', `Файл не найден: ${resolved}`, { filePath: resolved });
    }
    const text = fs.readFileSync(resolved, 'utf8');
    const loaded = parseProjectContent(text, path.basename(resolved, path.extname(resolved)));
    return { ...loaded, filePath: resolved };
  }

  if (input.source !== undefined) {
    if (!looksLikeInlineContent(input.source)) {
      const resolved = path.resolve(input.source);
      if (fs.existsSync(resolved)) {
        const text = fs.readFileSync(resolved, 'utf8');
        const loaded = parseProjectContent(text, path.basename(resolved, path.extname(resolved)));
        return { ...loaded, filePath: resolved };
      }
      throw new McpToolError('E_FILE_NOT_FOUND', `Файл не найден: ${resolved}`, { filePath: resolved });
    }
    return parseProjectContent(input.source);
  }

  if (sessionState?.project) {
    return {
      project: structuredClone(sessionState.project),
      format: 'session',
      filePath: sessionState.filePath,
    };
  }

  throw new McpToolError(
    'E_BAD_SOURCE',
    'Не указан источник проекта (file_path / content / project) и нет активного проекта в сессии'
  );
}

export function serializeProjectToNC(project: ProjectData): {
  ncContent: string;
  gcode: string;
  segments: ToolpathSegment[];
  warnings: string[];
} {
  const gen = generateGcode(
    project.objects,
    project.operations ?? [],
    project.machine,
    project.postprocessorTemplates ?? DEFAULT_TEMPLATES
  );
  const embeddedLine = `; ${PROJECT_JSON_TAG}:${JSON.stringify(project)}`;
  const ncContent = `${gen.gcode}\n${embeddedLine}\n`;
  return { ncContent, gcode: gen.gcode, segments: gen.segments, warnings: gen.warnings };
}

export interface PatchProjectParams {
  set_name?: string;
  set_machine?: Partial<MachineSettings> & { cutDepth?: number | null };
  clear_objects?: boolean;
  remove_ids?: string[];
  add?: McpObjectInput[];
  update?: Array<{ id: string; patch: Record<string, unknown> }>;
}

export function patchProject(
  project: ProjectData,
  params: PatchProjectParams
): {
  project: ProjectData;
  addedIds: string[];
  updatedIds: string[];
  removedIds: string[];
} {
  const next: ProjectData = structuredClone(project);

  if (params.set_name !== undefined && params.set_name.trim().length > 0) {
    next.name = params.set_name.trim();
  }

  if (params.set_machine) {
    const mPatch = params.set_machine;
    next.machine = {
      ...next.machine,
      ...mPatch,
      bounds: mPatch.bounds ? { ...next.machine.bounds, ...mPatch.bounds } : next.machine.bounds,
      workOffset: mPatch.workOffset
        ? { ...next.machine.workOffset, ...mPatch.workOffset }
        : next.machine.workOffset,
      stockSheet: mPatch.stockSheet
        ? {
            ...(next.machine.stockSheet ?? {
              enabled: true,
              preset: 'custom',
              widthX: 1081,
              widthY: 1681,
            }),
            ...mPatch.stockSheet,
          }
        : next.machine.stockSheet,
    };
    if (mPatch.cutDepth === null) {
      delete next.machine.cutDepth;
    }
  }

  const removedIds: string[] = [];
  if (params.clear_objects) {
    removedIds.push(...next.objects.map((o) => o.id));
    next.objects = [];
  } else if (params.remove_ids && params.remove_ids.length > 0) {
    const rmSet = new Set(params.remove_ids);
    const existingIds = new Set(next.objects.map((o) => o.id));
    for (const id of params.remove_ids) {
      if (!existingIds.has(id)) {
        throw new McpToolError('E_OBJECT_NOT_FOUND', `Объект для удаления не найден: ${id}`, { id });
      }
      removedIds.push(id);
    }
    next.objects = next.objects.filter((o) => !rmSet.has(o.id));
  }

  const updatedIds: string[] = [];
  if (params.update && params.update.length > 0) {
    for (const item of params.update) {
      const idx = next.objects.findIndex((o) => o.id === item.id);
      if (idx === -1) {
        throw new McpToolError('E_OBJECT_NOT_FOUND', `Объект для обновления не найден: ${item.id}`, {
          id: item.id,
        });
      }
      const cur = next.objects[idx];
      const patch = { ...item.patch };
      // Автоматически включаем useOwnDepth при явном обновлении depth отличном от machine.cutDepth
      if (
        typeof patch.depth === 'number' &&
        patch.useOwnDepth === undefined &&
        next.machine.cutDepth !== undefined &&
        Math.abs(Math.abs(patch.depth) - Math.abs(next.machine.cutDepth)) > 0.01
      ) {
        patch.useOwnDepth = true;
      }
      next.objects[idx] = { ...cur, ...patch, id: cur.id, type: cur.type } as CADObject;
      updatedIds.push(cur.id);
    }
  }

  const addedIds: string[] = [];
  if (params.add && params.add.length > 0) {
    for (const raw of params.add) {
      const created = normalizeMcpObject(raw, next.machine, next.objects.length + 1);
      next.objects.push(created);
      addedIds.push(created.id);
    }
  }

  return { project: next, addedIds, updatedIds, removedIds };
}

// ---------------------------------------------------------------------------
// CAD-операции поверх чистой геометрии src/lib/geometry/*
// ---------------------------------------------------------------------------

export type CadOpRequest =
  | {
      op: 'fillet_lines';
      id_a: string;
      id_b: string;
      radius: number;
      click_a?: Point2D;
      click_b?: Point2D;
    }
  | {
      op: 'fillet_rectangle';
      id: string;
      radius: number;
    }
  | {
      op: 'mirror';
      ids?: string[];
      axis: 'x' | 'y';
      anchor?: Point2D;
      copy?: boolean;
    }
  | {
      op: 'move';
      ids?: string[];
      dx: number;
      dy: number;
    }
  | {
      op: 'rotate';
      ids?: string[];
      angle_deg: number;
      anchor?: Point2D;
    }
  | {
      op: 'scale';
      ids?: string[];
      sx: number;
      sy?: number;
      anchor?: Point2D;
    }
  | {
      op: 'align_to_stock';
      ids?: string[];
      mode: StockAlignMode;
      margin_mm?: number;
    }
  | {
      op: 'join_contours';
      ids?: string[];
      tolerance_mm?: number;
    };

function selectTargetIds(objects: CADObject[], ids?: string[]): Set<string> {
  if (!ids || ids.length === 0) {
    if (objects.length === 0) {
      throw new McpToolError('E_NO_OBJECTS', 'В проекте нет фигур для CAD-операции');
    }
    return new Set(objects.map((o) => o.id));
  }
  const existing = new Set(objects.map((o) => o.id));
  for (const id of ids) {
    if (!existing.has(id)) {
      throw new McpToolError('E_OBJECT_NOT_FOUND', `Объект не найден: ${id}`, { id });
    }
  }
  return new Set(ids);
}

export function applyCadOperation(
  project: ProjectData,
  req: CadOpRequest
): { project: ProjectData; summary: Record<string, unknown> } {
  const next: ProjectData = structuredClone(project);

  if (req.op === 'fillet_lines') {
    const idxA = next.objects.findIndex((o) => o.id === req.id_a);
    const idxB = next.objects.findIndex((o) => o.id === req.id_b);
    if (idxA === -1 || idxB === -1) {
      throw new McpToolError('E_OBJECT_NOT_FOUND', 'Одна или обе линии для скругления не найдены', {
        id_a: req.id_a,
        id_b: req.id_b,
      });
    }
    const objA = next.objects[idxA];
    const objB = next.objects[idxB];
    if (objA.type !== 'line' || objB.type !== 'line') {
      throw new McpToolError('E_FILLET_FAILED', 'Обе фигуры для fillet_lines должны иметь type="line"');
    }
    const outcome = computeTwoLineFillet(objA, objB, req.radius, req.click_a, req.click_b);
    if (!outcome.ok) {
      throw new McpToolError('E_FILLET_FAILED', outcome.reason);
    }
    next.objects[idxA] = { ...objA, ...outcome.result.lineA };
    next.objects[idxB] = { ...objB, ...outcome.result.lineB };
    const arcId = createObjectId('fillet');
    const arcObj: ArcObject = {
      id: arcId,
      name: `Скругление R${req.radius}`,
      type: 'arc',
      ...outcome.result.arc,
      depth: objA.depth,
      ...(objA.useOwnDepth !== undefined ? { useOwnDepth: objA.useOwnDepth } : {}),
      operationType: objA.operationType,
    };
    next.objects.push(arcObj);
    return {
      project: next,
      summary: { op: 'fillet_lines', arcId, arc: outcome.result.arc },
    };
  }

  if (req.op === 'fillet_rectangle') {
    const idx = next.objects.findIndex((o) => o.id === req.id);
    if (idx === -1) {
      throw new McpToolError('E_OBJECT_NOT_FOUND', `Прямоугольник не найден: ${req.id}`, { id: req.id });
    }
    const obj = next.objects[idx];
    if (obj.type !== 'rectangle') {
      throw new McpToolError('E_FILLET_FAILED', `Объект ${req.id} не является прямоугольником`);
    }
    const maxR = Math.min(Math.abs(obj.width), Math.abs(obj.height)) / 2;
    if (req.radius < 0 || req.radius > maxR + 0.01) {
      throw new McpToolError(
        'E_FILLET_FAILED',
        `Радиус ${req.radius} мм вне допустимого диапазона [0..${maxR.toFixed(1)}]`
      );
    }
    next.objects[idx] = { ...obj, cornerRadius: req.radius };
    return {
      project: next,
      summary: { op: 'fillet_rectangle', id: obj.id, cornerRadius: req.radius },
    };
  }

  if (req.op === 'move') {
    const targetIds = selectTargetIds(next.objects, req.ids);
    next.objects = next.objects.map((o) => (targetIds.has(o.id) ? translateCADObject(o, req.dx, req.dy) : o));
    return {
      project: next,
      summary: { op: 'move', affected: targetIds.size, dx: req.dx, dy: req.dy },
    };
  }

  if (req.op === 'mirror') {
    const targetIds = selectTargetIds(next.objects, req.ids);
    const targets = next.objects.filter((o) => targetIds.has(o.id));
    const bounds = computeObjectsBounds(targets);
    const anchor: Point2D =
      req.anchor ??
      (bounds
        ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
        : { x: 0, y: 0 });

    if (req.copy) {
      const copies: CADObject[] = targets.map((o) => {
        const m = mirrorCADObject(o, req.axis, anchor);
        m.id = createObjectId('mir');
        m.name = `${o.name} (зерк.)`;
        return m;
      });
      next.objects.push(...copies);
      return {
        project: next,
        summary: { op: 'mirror', copy: true, axis: req.axis, anchor, createdIds: copies.map((c) => c.id) },
      };
    }

    next.objects = next.objects.map((o) => (targetIds.has(o.id) ? mirrorCADObject(o, req.axis, anchor) : o));
    return {
      project: next,
      summary: { op: 'mirror', copy: false, axis: req.axis, anchor, affected: targetIds.size },
    };
  }

  if (req.op === 'rotate') {
    const targetIds = selectTargetIds(next.objects, req.ids);
    const targets = next.objects.filter((o) => targetIds.has(o.id));
    const bounds = computeObjectsBounds(targets);
    const anchor: Point2D =
      req.anchor ??
      (bounds
        ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
        : { x: 0, y: 0 });
    next.objects = next.objects.map((o) =>
      targetIds.has(o.id) ? rotateCADObject(o, req.angle_deg, anchor) : o
    );
    return {
      project: next,
      summary: { op: 'rotate', angleDeg: req.angle_deg, anchor, affected: targetIds.size },
    };
  }

  if (req.op === 'scale') {
    const targetIds = selectTargetIds(next.objects, req.ids);
    const targets = next.objects.filter((o) => targetIds.has(o.id));
    const bounds = computeObjectsBounds(targets);
    const anchor: Point2D =
      req.anchor ??
      (bounds
        ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
        : { x: 0, y: 0 });
    const sy = req.sy ?? req.sx;
    next.objects = next.objects.map((o) => (targetIds.has(o.id) ? scaleCADObject(o, anchor, req.sx, sy) : o));
    return {
      project: next,
      summary: { op: 'scale', sx: req.sx, sy, anchor, affected: targetIds.size },
    };
  }

  if (req.op === 'align_to_stock') {
    const targetIds = selectTargetIds(next.objects, req.ids);
    const targets = next.objects.filter((o) => targetIds.has(o.id));
    const delta = computeStockAlignmentDelta(targets, next.machine.stockSheet, req.mode, req.margin_mm ?? 0);
    if (!delta) {
      throw new McpToolError(
        'E_INVALID_INPUT',
        'Невозможно выровнять по листу: задайте положительные widthX и widthY в machine.stockSheet'
      );
    }
    next.objects = next.objects.map((o) =>
      targetIds.has(o.id) ? translateCADObject(o, delta.dx, delta.dy) : o
    );
    return {
      project: next,
      summary: { op: 'align_to_stock', mode: req.mode, dx: delta.dx, dy: delta.dy, affected: targetIds.size },
    };
  }

  if (req.op === 'join_contours') {
    const targetIds = selectTargetIds(next.objects, req.ids);
    const targets = next.objects.filter((o) => targetIds.has(o.id));
    const res = joinSelectedContours(targets, req.tolerance_mm ?? 0.5);
    if (res.consumedIds.length === 0) {
      return {
        project: next,
        summary: { op: 'join_contours', joinedCount: 0, createdIds: [] },
      };
    }
    const consumedSet = new Set(res.consumedIds);
    const created: CADObject[] = res.joinedPolylines.map((p: NewCADObjectInput) => ({
      ...p,
      id: p.id || createObjectId('poly'),
    })) as CADObject[];
    next.objects = [...next.objects.filter((o) => !consumedSet.has(o.id)), ...created];
    return {
      project: next,
      summary: {
        op: 'join_contours',
        joinedCount: res.joinedSourceCount,
        consumedIds: res.consumedIds,
        createdIds: created.map((c) => c.id),
      },
    };
  }

  throw new McpToolError('E_INVALID_INPUT', 'Неизвестная CAD-операция');
}

// ---------------------------------------------------------------------------
// Чистый SVG-рендерер превью (геометрия + траектория + опциональная фото-подложка)
// ---------------------------------------------------------------------------

export interface PreviewSvgOptions {
  widthPx?: number;
  heightPx?: number;
  showToolpath?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
  backgroundImagePath?: string;
  backgroundOpacity?: number;
  /** Область подложки в мировых координатах (по умолчанию — лист stockSheet или bbox фигур). */
  backgroundBounds?: { minX: number; maxX: number; minY: number; maxY: number };
}

function escapeXml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

function effectiveDepthOf(obj: CADObject, machine: MachineSettings): number {
  if (obj.type === 'point') return obj.depth;
  return obj.useOwnDepth ? (obj.depth ?? machine.cutDepth ?? 5) : (machine.cutDepth ?? obj.depth ?? 5);
}

/**
 * Генерирует самодостаточный SVG в той же экранной ориентации, что и 2D-холст EZNC:
 *  - горизонталь (слева→направо) = мировая ось Y (minY .. maxY)
 *  - вертикаль   (сверху→вниз)   = мировая ось X (minX .. maxX)
 */
export function renderProjectSvg(
  project: ProjectData,
  opts: PreviewSvgOptions = {}
): {
  svg: string;
  viewWorld: { minX: number; maxX: number; minY: number; maxY: number };
  stats: ReturnType<typeof computeToolpathStats>;
  warningCount: number;
} {
  const widthPx = Math.max(320, Math.min(2400, opts.widthPx ?? 1200));
  const showToolpath = opts.showToolpath ?? true;
  const showLabels = opts.showLabels ?? true;
  const showGrid = opts.showGrid ?? true;

  const { machine, objects } = project;
  const mb = normalizeMachineBounds(machine.bounds);
  const stock = machine.stockSheet;
  const objBounds = computeObjectsBounds(objects.filter((o) => o.visible !== false));

  // Выбираем рабочую область кадра: охватываем фигуры и лист (или рабочее поле, если проект пуст)
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const includeBox = (b: { minX: number; maxX: number; minY: number; maxY: number }) => {
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
  };

  if (objBounds) includeBox(objBounds);
  if (stock?.enabled && stock.widthX > 0 && stock.widthY > 0) {
    includeBox({ minX: -stock.widthX, maxX: 0, minY: -stock.widthY, maxY: 0 });
  }
  if (opts.backgroundBounds) includeBox(opts.backgroundBounds);
  if (!Number.isFinite(minX)) {
    includeBox({ minX: mb.minX, maxX: mb.maxX, minY: mb.minY, maxY: mb.maxY });
  }

  const spanX = Math.max(50, maxX - minX);
  const spanY = Math.max(50, maxY - minY);
  const marginWorld = Math.max(spanX, spanY) * 0.08;
  const viewMinX = minX - marginWorld;
  const viewMaxX = maxX + marginWorld;
  const viewMinY = minY - marginWorld;
  const viewMaxY = maxY + marginWorld;

  const padPx = 48;
  const usableW = widthPx - padPx * 2;
  const worldW = viewMaxY - viewMinY;
  const worldH = viewMaxX - viewMinX;
  const heightPx = opts.heightPx ?? Math.max(320, Math.round((usableW * worldH) / worldW + padPx * 2));
  const usableH = heightPx - padPx * 2;
  const scale = Math.min(usableW / worldW, usableH / worldH);

  const offsetX = padPx + (usableW - worldW * scale) / 2;
  const offsetY = padPx + (usableH - worldH * scale) / 2;

  // World (wx, wy) → SVG (sx, sy), совпадает с worldToCanvas
  const toSvg = (wx: number, wy: number) => ({
    sx: offsetX + (wy - viewMinY) * scale,
    sy: offsetY + (wx - viewMinX) * scale,
  });

  const gen = generateGcode(
    objects,
    project.operations ?? [],
    machine,
    project.postprocessorTemplates ?? DEFAULT_TEMPLATES
  );
  const stats = computeToolpathStats(gen.segments, machine);
  const warnings = analyzeProjectWarnings(objects, project.operations ?? [], machine);
  const boundsCheck = analyzeTrajectoryBounds(gen.segments, machine, objects);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">`
  );
  parts.push(`<rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#f8fafc"/>`);

  // 1. Опциональная фото-подложка (прямо внутри SVG, без matplotlib!)
  if (opts.backgroundImagePath) {
    const imgPath = path.resolve(opts.backgroundImagePath);
    if (!fs.existsSync(imgPath)) {
      throw new McpToolError('E_FILE_NOT_FOUND', `Файл фото-подложки не найден: ${imgPath}`, {
        filePath: imgPath,
      });
    }
    const dataUri = `data:${mimeFromExt(imgPath)};base64,${fs.readFileSync(imgPath).toString('base64')}`;
    const bgBox =
      opts.backgroundBounds ??
      (stock?.enabled && stock.widthX > 0 && stock.widthY > 0
        ? { minX: -stock.widthX, maxX: 0, minY: -stock.widthY, maxY: 0 }
        : objBounds ?? { minX: mb.minX, maxX: mb.maxX, minY: mb.minY, maxY: mb.maxY });
    const tl = toSvg(bgBox.minX, bgBox.minY);
    const br = toSvg(bgBox.maxX, bgBox.maxY);
    const bgOpacity = Math.max(0.05, Math.min(1, opts.backgroundOpacity ?? 0.5));
    parts.push(
      `<image href="${dataUri}" x="${tl.sx.toFixed(1)}" y="${tl.sy.toFixed(1)}" width="${(br.sx - tl.sx).toFixed(1)}" height="${(br.sy - tl.sy).toFixed(1)}" opacity="${bgOpacity}" preserveAspectRatio="none"/>`
    );
  }

  // 2. Сетка и оси
  if (showGrid) {
    const rawStep = Math.max(worldW, worldH) / 10;
    const step = rawStep <= 50 ? 50 : rawStep <= 100 ? 100 : rawStep <= 200 ? 200 : 500;
    parts.push('<g stroke="#e2e8f0" stroke-width="1">');
    for (let wy = Math.ceil(viewMinY / step) * step; wy <= viewMaxY; wy += step) {
      const p1 = toSvg(viewMinX, wy);
      const p2 = toSvg(viewMaxX, wy);
      parts.push(`<line x1="${p1.sx.toFixed(1)}" y1="${p1.sy.toFixed(1)}" x2="${p2.sx.toFixed(1)}" y2="${p2.sy.toFixed(1)}"/>`);
    }
    for (let wx = Math.ceil(viewMinX / step) * step; wx <= viewMaxX; wx += step) {
      const p1 = toSvg(wx, viewMinY);
      const p2 = toSvg(wx, viewMaxY);
      parts.push(`<line x1="${p1.sx.toFixed(1)}" y1="${p1.sy.toFixed(1)}" x2="${p2.sx.toFixed(1)}" y2="${p2.sy.toFixed(1)}"/>`);
    }
    parts.push('</g>');

    // Подписи координат по краям
    parts.push('<g fill="#64748b" font-family="monospace" font-size="10">');
    for (let wy = Math.ceil(viewMinY / step) * step; wy <= viewMaxY; wy += step) {
      const p = toSvg(viewMaxX, wy);
      parts.push(`<text x="${p.sx.toFixed(1)}" y="${(heightPx - 12).toFixed(1)}" text-anchor="middle">Y${wy}</text>`);
    }
    for (let wx = Math.ceil(viewMinX / step) * step; wx <= viewMaxX; wx += step) {
      const p = toSvg(wx, viewMinY);
      parts.push(`<text x="6" y="${(p.sy + 3).toFixed(1)}">X${wx}</text>`);
    }
    parts.push('</g>');
  }

  // 3. Рабочее поле станка (пунктир) и лист ДСП (зелёная рамка)
  const mbTL = toSvg(mb.minX, mb.minY);
  const mbBR = toSvg(mb.maxX, mb.maxY);
  parts.push(
    `<rect x="${mbTL.sx.toFixed(1)}" y="${mbTL.sy.toFixed(1)}" width="${(mbBR.sx - mbTL.sx).toFixed(1)}" height="${(mbBR.sy - mbTL.sy).toFixed(1)}" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="6,4"/>`
  );

  if (stock?.enabled && stock.widthX > 0 && stock.widthY > 0) {
    const sTL = toSvg(-stock.widthX, -stock.widthY);
    const sBR = toSvg(0, 0);
    parts.push(
      `<rect x="${sTL.sx.toFixed(1)}" y="${sTL.sy.toFixed(1)}" width="${(sBR.sx - sTL.sx).toFixed(1)}" height="${(sBR.sy - sTL.sy).toFixed(1)}" fill="rgba(34,197,94,0.05)" stroke="#16a34a" stroke-width="1.6" stroke-dasharray="8,4"/>`
    );
  }

  // Ноль станка (0, 0)
  const origin = toSvg(0, 0);
  parts.push(
    `<circle cx="${origin.sx.toFixed(1)}" cy="${origin.sy.toFixed(1)}" r="4" fill="#ef4444"/><text x="${(origin.sx + 6).toFixed(1)}" y="${(origin.sy - 6).toFixed(1)}" fill="#ef4444" font-family="monospace" font-size="11" font-weight="bold">(0,0)</text>`
  );

  // 4. Траектория холостых ходов (если включена)
  if (showToolpath && gen.segments.length > 0) {
    parts.push('<g fill="none" stroke="#f97316" stroke-width="1" stroke-dasharray="4,4" opacity="0.65">');
    for (const seg of gen.segments) {
      if (seg.type !== 'rapid') continue;
      if (Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY) < 0.1) continue;
      const p1 = toSvg(seg.startX, seg.startY);
      const p2 = toSvg(seg.endX, seg.endY);
      parts.push(`<line x1="${p1.sx.toFixed(1)}" y1="${p1.sy.toFixed(1)}" x2="${p2.sx.toFixed(1)}" y2="${p2.sy.toFixed(1)}"/>`);
    }
    parts.push('</g>');
  }

  // 5. CAD-объекты (цветовое кодирование: сквозной рез vs паз по useOwnDepth)
  const globalDepth = machine.cutDepth ?? 17.5;
  for (const obj of objects) {
    if (obj.visible === false) continue;
    const effDepth = effectiveDepthOf(obj, machine);
    const isGroove = obj.type !== 'point' && effDepth < globalDepth - 0.5;
    const stroke = obj.color || (isGroove ? '#dc2626' : '#0f172a');
    const sw = isGroove ? 2.2 : 2.6;

    let labelPt: { sx: number; sy: number } | null = null;

    if (obj.type === 'line') {
      const p1 = toSvg(obj.startX, obj.startY);
      const p2 = toSvg(obj.endX, obj.endY);
      parts.push(
        `<line x1="${p1.sx.toFixed(2)}" y1="${p1.sy.toFixed(2)}" x2="${p2.sx.toFixed(2)}" y2="${p2.sy.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
      );
      labelPt = { sx: (p1.sx + p2.sx) / 2, sy: (p1.sy + p2.sy) / 2 };
    } else if (obj.type === 'polyline' && obj.points.length >= 2) {
      const pts = obj.points.map((p) => toSvg(p.x, p.y));
      const d =
        pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.sx.toFixed(2)},${p.sy.toFixed(2)}`).join(' ') +
        (obj.closed ? ' Z' : '');
      parts.push(
        `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`
      );
      labelPt = pts[Math.floor(pts.length / 2)];
    } else if (obj.type === 'rectangle') {
      const p1 = toSvg(Math.min(obj.x, obj.x + obj.width), Math.min(obj.y, obj.y + obj.height));
      const p2 = toSvg(Math.max(obj.x, obj.x + obj.width), Math.max(obj.y, obj.y + obj.height));
      const rx = Math.max(0, (obj.cornerRadius ?? 0) * scale);
      parts.push(
        `<rect x="${p1.sx.toFixed(2)}" y="${p1.sy.toFixed(2)}" width="${(p2.sx - p1.sx).toFixed(2)}" height="${(p2.sy - p1.sy).toFixed(2)}" rx="${rx.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`
      );
      labelPt = { sx: (p1.sx + p2.sx) / 2, sy: p1.sy - 6 };
    } else if (obj.type === 'circle') {
      const cp = toSvg(obj.centerX, obj.centerY);
      const rPx = obj.radius * scale;
      parts.push(
        `<circle cx="${cp.sx.toFixed(2)}" cy="${cp.sy.toFixed(2)}" r="${rPx.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`
      );
      labelPt = cp;
    } else if (obj.type === 'arc') {
      const cp = toSvg(obj.centerX, obj.centerY);
      const pS = toSvg(obj.startX, obj.startY);
      const pE = toSvg(obj.endX, obj.endY);
      const rPx = obj.radius * scale;
      const a1 = Math.atan2(pS.sy - cp.sy, pS.sx - cp.sx);
      const a2 = Math.atan2(pE.sy - cp.sy, pE.sx - cp.sx);
      const TAU = Math.PI * 2;
      // В экранных координатах (sy вниз, sx=wy, sy=wx): obj.clockwise=true → sweepFlag=1
      const sweepFlag = obj.clockwise ? 1 : 0;
      const delta = sweepFlag === 1 ? ((a2 - a1) % TAU + TAU) % TAU : ((a1 - a2) % TAU + TAU) % TAU;
      const largeArcFlag = delta > Math.PI ? 1 : 0;
      parts.push(
        `<path d="M${pS.sx.toFixed(2)},${pS.sy.toFixed(2)} A${rPx.toFixed(2)},${rPx.toFixed(2)} 0 ${largeArcFlag} ${sweepFlag} ${pE.sx.toFixed(2)},${pE.sy.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
      );
      labelPt = { sx: (pS.sx + pE.sx) / 2, sy: (pS.sy + pE.sy) / 2 };
    } else if (obj.type === 'point') {
      const cp = toSvg(obj.x, obj.y);
      const rPx = Math.max(4, (obj.diameter / 2) * scale);
      parts.push(
        `<circle cx="${cp.sx.toFixed(2)}" cy="${cp.sy.toFixed(2)}" r="${rPx.toFixed(2)}" fill="rgba(37,99,235,0.2)" stroke="#2563eb" stroke-width="1.8"/>`
      );
      labelPt = { sx: cp.sx + rPx + 4, sy: cp.sy - 2 };
    }

    if (showLabels && labelPt) {
      parts.push(
        `<text x="${(labelPt.sx + 4).toFixed(1)}" y="${(labelPt.sy - 4).toFixed(1)}" fill="${stroke}" font-family="monospace" font-size="10" font-weight="600">${escapeXml(obj.id)} (Z-${effDepth})</text>`
      );
    }
  }

  // 6. Информационная шапка превью
  const statusColor = boundsCheck.outOfBounds || warnings.some((w) => w.level === 'error') ? '#dc2626' : '#15803d';
  const summaryText = `${project.name} · фигур: ${objects.length} · рез: ${formatDistanceRu(stats.cutLengthMm)} · холост.: ${formatDistanceRu(stats.rapidLengthMm)} · ~${formatDurationRu(stats.estimatedSeconds)} · ${boundsCheck.outOfBounds ? 'OUT OF BOUNDS' : 'OK'}`;
  parts.push(
    `<rect x="12" y="8" width="${Math.min(widthPx - 24, 760)}" height="24" rx="6" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1"/>`
  );
  parts.push(
    `<text x="22" y="24" fill="${statusColor}" font-family="monospace" font-size="11" font-weight="700">${escapeXml(summaryText)}</text>`
  );

  parts.push('</svg>');

  return {
    svg: parts.join('\n'),
    viewWorld: { minX: viewMinX, maxX: viewMaxX, minY: viewMinY, maxY: viewMaxY },
    stats,
    warningCount: warnings.length,
  };
}

export function buildValidationReport(project: ProjectData) {
  const gen = generateGcode(
    project.objects,
    project.operations ?? [],
    project.machine,
    project.postprocessorTemplates ?? DEFAULT_TEMPLATES
  );
  const warnings = analyzeProjectWarnings(project.objects, project.operations ?? [], project.machine);
  const bounds = analyzeTrajectoryBounds(gen.segments, project.machine, project.objects);
  const stats = computeToolpathStats(gen.segments, project.machine);

  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;

  return {
    ok: errorCount === 0 && !bounds.outOfBounds,
    errorCount,
    warningCount,
    warnings,
    bounds: {
      ...bounds,
      outOfBoundsSegmentIds: Array.from(bounds.outOfBoundsSegmentIds),
    },
    stats: {
      ...stats,
      cutLengthFormatted: formatDistanceRu(stats.cutLengthMm),
      rapidLengthFormatted: formatDistanceRu(stats.rapidLengthMm),
      durationFormatted: formatDurationRu(stats.estimatedSeconds),
    },
  };
}

export { parseGcodeToSegments };

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { CADObject, MachineSettings, ProjectData } from '../src/types/index.ts';
import { INITIAL_MACHINE } from '../src/store/initialState.ts';
import { parseGcodeToCadObjects, parseGcodeToSegments } from '../src/lib/gcode/parser.ts';
import { computeToolpathStats, formatDistanceRu, formatDurationRu } from '../src/lib/gcode/stats.ts';
import { optimizeCADObjects } from '../src/lib/geometry/optimizer.ts';
import {
  parseDXFContent,
  parseSVGContent,
  prepareVectorImportObjects,
} from '../src/lib/import/vectorImport.ts';
import { createObjectId } from '../src/lib/utils/id.ts';
import {
  type CadOpRequest,
  McpToolError,
  type McpObjectInput,
  applyCadOperation,
  buildValidationReport,
  createNewProject,
  loadProjectInput,
  patchProject,
  renderProjectSvg,
  serializeProjectToNC,
  writeTextSafe,
} from './helpers.ts';

// Строго пишем логи только в stderr — stdout зарезервирован под JSON-RPC 2.0 MCP.
function logStderr(msg: string): void {
  process.stderr.write(`[eznc-mcp] ${msg}\n`);
}

function okResult(payload: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, ...payload }, null, 2) }],
  };
}

function errResult(err: unknown) {
  if (err instanceof McpToolError) {
    return {
      isError: true as const,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              ok: false,
              code: err.code,
              message: err.message,
              ...(err.details ? { details: err.details } : {}),
            },
            null,
            2
          ),
        },
      ],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ ok: false, code: 'E_INTERNAL', message }, null, 2),
      },
    ],
  };
}

// Общие Zod-схемы входных данных
const Point2DSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const ProjectRefFields = {
  file_path: z.string().optional().describe('Путь к файлу проекта (.json или .nc). Имеет приоритет над source.'),
  content: z.string().optional().describe('Содержимое проекта (JSON) или G-код строкой.'),
  project: z.record(z.string(), z.unknown()).optional().describe('Объект ProjectData напрямую.'),
  source: z
    .string()
    .optional()
    .describe('Legacy-поле: путь к файлу или inline JSON/G-код. Если не задан ни один источник — берётся активный проект сессии.'),
};

const ObjectInputSchema = z.record(z.string(), z.unknown()).describe(
  'CAD-объект (line | polyline | rectangle | circle | arc | point) или удобная дуга (arc_3pt: {type:"arc_3pt", start, through, end} / arc_bulge: {type:"arc_bulge", start, end, apex}). Если задан depth != machine.cutDepth, useOwnDepth включается автоматически.'
);

export interface EzncMcpSession {
  project: ProjectData | null;
  filePath?: string;
}

export function createEzncMcpServer() {
  const session: EzncMcpSession = { project: null, filePath: undefined };

  const server = new McpServer({
    name: 'eznc-studio',
    version: '2.0.0',
  });

  const rememberSession = (project: ProjectData, filePath?: string) => {
    session.project = structuredClone(project);
    if (filePath) session.filePath = path.resolve(filePath);
  };

  const maybePersist = (project: ProjectData, outPath?: string): string | undefined => {
    if (!outPath) return undefined;
    const ext = path.extname(outPath).toLowerCase();
    if (ext === '.nc' || ext === '.gcode' || ext === '.cnc' || ext === '.tap') {
      const { ncContent } = serializeProjectToNC(project);
      return writeTextSafe(outPath, ncContent);
    }
    return writeTextSafe(outPath, JSON.stringify(project, null, 2));
  };

  // 1. project_create — создание проекта с нуля (без входного файла)
  server.registerTool(
    'project_create',
    {
      title: 'Создать проект EZNC с нуля',
      description:
        'Создаёт новый проект EZNC (пресет head = Изголовье Ø3/17.5мм или rail = Царга Ø8/33.5мм), задаёт размеры листа (widthY — ширина по горизонтали -Y, widthX — высота по вертикали -X), опционально добавляет фигуры и сохраняет в .json/.nc. Ставит проект активным в сессии.',
      inputSchema: {
        name: z.string().optional().describe('Название проекта'),
        mode: z.enum(['head', 'rail']).optional().describe('Пресет: head (Изголовье Ø3) или rail (Царга Ø8)'),
        sheet_width_y: z.number().positive().optional().describe('Ширина листа по оси Y (горизонталь экрана), мм'),
        sheet_height_x: z.number().positive().optional().describe('Высота листа по оси X (вертикаль экрана), мм'),
        enable_stock_sheet: z.boolean().optional().describe('Показать рамку листа ДСП'),
        cut_depth: z
          .number()
          .nullable()
          .optional()
          .describe('Глобальная глубина реза Z (положительное число, мм) или null для индивидуальных глубин'),
        objects: z.array(ObjectInputSchema).optional().describe('Начальный список фигур (включая arc_3pt / arc_bulge)'),
        out_path: z.string().optional().describe('Если указан — сразу сохранить в .json или .nc'),
      },
    },
    async (args) => {
      try {
        const project = createNewProject({
          name: args.name,
          mode: args.mode,
          sheetWidthY: args.sheet_width_y,
          sheetHeightX: args.sheet_height_x,
          enableStockSheet: args.enable_stock_sheet,
          cutDepth: args.cut_depth,
          objects: args.objects as McpObjectInput[] | undefined,
        });
        const writtenPath = maybePersist(project, args.out_path);
        rememberSession(project, writtenPath);
        return okResult({
          projectName: project.name,
          objectCount: project.objects.length,
          objectIds: project.objects.map((o) => o.id),
          machine: project.machine,
          ...(writtenPath ? { writtenPath } : {}),
          project,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 2. project_open — открыть проект (.json / .nc с встроенным тегом / чистый G-код)
  server.registerTool(
    'project_open',
    {
      title: 'Открыть проект (.json / .nc)',
      description:
        'Читает проект из .json или .nc (извлекает ; NCSTUDIO_PROJECT:{...} либо парсит G-код в фигуры) и делает его активным в сессии.',
      inputSchema: {
        ...ProjectRefFields,
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );
        rememberSession(loaded.project, loaded.filePath);
        const validation = buildValidationReport(loaded.project);
        return okResult({
          format: loaded.format,
          ...(loaded.filePath ? { filePath: loaded.filePath } : {}),
          objectCount: loaded.project.objects.length,
          objectIds: loaded.project.objects.map((o) => o.id),
          validationOk: validation.ok,
          warningCount: validation.warningCount,
          errorCount: validation.errorCount,
          project: loaded.project,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 3. project_patch — точечные правки объектов/станка по id (с поддержкой активной сессии)
  server.registerTool(
    'project_patch',
    {
      title: 'Точечно изменить проект (add / update / remove)',
      description:
        'Добавляет, обновляет или удаляет фигуры по id (поддерживает arc_3pt / arc_bulge и автоматический useOwnDepth при отличии depth от machine.cutDepth), меняет настройки станка. Если источник не передан — правит активный проект сессии.',
      inputSchema: {
        ...ProjectRefFields,
        set_name: z.string().optional(),
        set_machine: z.record(z.string(), z.unknown()).optional(),
        clear_objects: z.boolean().optional(),
        remove_ids: z.array(z.string()).optional(),
        add: z.array(ObjectInputSchema).optional(),
        update: z
          .array(
            z.object({
              id: z.string(),
              patch: z.record(z.string(), z.unknown()),
            })
          )
          .optional(),
        out_path: z.string().optional().describe('Путь для сохранения результата (.json или .nc); если не указан, но проект открыт из файла и save_in_place=true, перезаписывает его.'),
        save_in_place: z.boolean().optional().describe('Перезаписать исходный file_path на диске'),
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );
        const res = patchProject(loaded.project, {
          set_name: args.set_name,
          set_machine: args.set_machine as (Partial<MachineSettings> & { cutDepth?: number | null }) | undefined,
          clear_objects: args.clear_objects,
          remove_ids: args.remove_ids,
          add: args.add as McpObjectInput[] | undefined,
          update: args.update,
        });
        const saveTarget = args.out_path ?? (args.save_in_place ? loaded.filePath : undefined);
        const writtenPath = maybePersist(res.project, saveTarget);
        rememberSession(res.project, writtenPath ?? loaded.filePath);
        const validation = buildValidationReport(res.project);
        return okResult({
          addedIds: res.addedIds,
          updatedIds: res.updatedIds,
          removedIds: res.removedIds,
          objectCount: res.project.objects.length,
          ...(writtenPath ? { writtenPath } : {}),
          validationOk: validation.ok,
          bounds: {
            outOfBounds: validation.bounds.outOfBounds,
            trajMinX: validation.bounds.trajMinX,
            trajMaxX: validation.bounds.trajMaxX,
            trajMinY: validation.bounds.trajMinY,
            trajMaxY: validation.bounds.trajMaxY,
          },
          project: res.project,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 4. cad_operate — настоящие CAD-операции из src/lib/geometry/* (fillet, mirror, move, rotate, scale, align_to_stock, join)
  server.registerTool(
    'cad_operate',
    {
      title: 'Выполнить CAD-операцию (fillet / mirror / align / join)',
      description:
        'Выполняет точные геометрические операции ядра EZNC без ручного расчёта дуг и координат: fillet_lines (правильная внутренняя дуга скругления), fillet_rectangle, mirror (включая copy:true для симметрии половины изголовья), move, rotate, scale, align_to_stock, join_contours.',
      inputSchema: {
        ...ProjectRefFields,
        op: z.enum([
          'fillet_lines',
          'fillet_rectangle',
          'mirror',
          'move',
          'rotate',
          'scale',
          'align_to_stock',
          'join_contours',
        ]),
        ids: z.array(z.string()).optional().describe('Целевые id (если не указаны — все объекты проекта)'),
        id: z.string().optional().describe('id прямоугольника (для fillet_rectangle)'),
        id_a: z.string().optional().describe('Первый отрезок (для fillet_lines)'),
        id_b: z.string().optional().describe('Второй отрезок (для fillet_lines)'),
        radius: z.number().optional().describe('Радиус скругления, мм'),
        click_a: Point2DSchema.optional().describe('Опциональная подсказка стороны для fillet_lines'),
        click_b: Point2DSchema.optional().describe('Опциональная подсказка стороны для fillet_lines'),
        axis: z.enum(['x', 'y']).optional().describe('Ось отражения для mirror: y — лево↔право (симметрия изголовья), x — верх↔низ'),
        anchor: Point2DSchema.optional().describe('Опорная точка (по умолчанию — центр bbox выделения)'),
        copy: z.boolean().optional().describe('Для mirror: создать зеркальную копию рядом (true) или отразить на месте (false)'),
        dx: z.number().optional(),
        dy: z.number().optional(),
        angle_deg: z.number().optional(),
        sx: z.number().optional(),
        sy: z.number().optional(),
        mode: z
          .enum([
            'topLeft',
            'topCenter',
            'topRight',
            'centerLeft',
            'center',
            'centerRight',
            'bottomLeft',
            'bottomCenter',
            'bottomRight',
          ])
          .optional()
          .describe('Режим выравнивания по листу для align_to_stock'),
        margin_mm: z.number().optional(),
        tolerance_mm: z.number().positive().optional(),
        out_path: z.string().optional(),
        save_in_place: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );

        let req: CadOpRequest;
        switch (args.op) {
          case 'fillet_lines':
            if (!args.id_a || !args.id_b || typeof args.radius !== 'number') {
              throw new McpToolError('E_INVALID_INPUT', 'fillet_lines требует id_a, id_b и radius');
            }
            req = {
              op: 'fillet_lines',
              id_a: args.id_a,
              id_b: args.id_b,
              radius: args.radius,
              click_a: args.click_a,
              click_b: args.click_b,
            };
            break;
          case 'fillet_rectangle':
            if (!args.id || typeof args.radius !== 'number') {
              throw new McpToolError('E_INVALID_INPUT', 'fillet_rectangle требует id и radius');
            }
            req = { op: 'fillet_rectangle', id: args.id, radius: args.radius };
            break;
          case 'mirror':
            if (!args.axis) {
              throw new McpToolError('E_INVALID_INPUT', 'mirror требует axis ("x" или "y")');
            }
            req = { op: 'mirror', ids: args.ids, axis: args.axis, anchor: args.anchor, copy: args.copy };
            break;
          case 'move':
            if (typeof args.dx !== 'number' || typeof args.dy !== 'number') {
              throw new McpToolError('E_INVALID_INPUT', 'move требует dx и dy');
            }
            req = { op: 'move', ids: args.ids, dx: args.dx, dy: args.dy };
            break;
          case 'rotate':
            if (typeof args.angle_deg !== 'number') {
              throw new McpToolError('E_INVALID_INPUT', 'rotate требует angle_deg');
            }
            req = { op: 'rotate', ids: args.ids, angle_deg: args.angle_deg, anchor: args.anchor };
            break;
          case 'scale':
            if (typeof args.sx !== 'number') {
              throw new McpToolError('E_INVALID_INPUT', 'scale требует sx');
            }
            req = { op: 'scale', ids: args.ids, sx: args.sx, sy: args.sy, anchor: args.anchor };
            break;
          case 'align_to_stock':
            if (!args.mode) {
              throw new McpToolError('E_INVALID_INPUT', 'align_to_stock требует mode');
            }
            req = { op: 'align_to_stock', ids: args.ids, mode: args.mode, margin_mm: args.margin_mm };
            break;
          case 'join_contours':
            req = { op: 'join_contours', ids: args.ids, tolerance_mm: args.tolerance_mm };
            break;
        }

        const res = applyCadOperation(loaded.project, req);
        const saveTarget = args.out_path ?? (args.save_in_place ? loaded.filePath : undefined);
        const writtenPath = maybePersist(res.project, saveTarget);
        rememberSession(res.project, writtenPath ?? loaded.filePath);
        return okResult({
          ...res.summary,
          objectCount: res.project.objects.length,
          ...(writtenPath ? { writtenPath } : {}),
          project: res.project,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 5. project_write — сохранить проект в .json и/или .nc (с тегом ; NCSTUDIO_PROJECT:{...})
  server.registerTool(
    'project_write',
    {
      title: 'Сохранить проект (.json / .nc)',
      description:
        'Записывает проект в .json и/или .nc (с G-кодом и встроенным тегом ; NCSTUDIO_PROJECT:{...}, совместимым с loadProjectNC).',
      inputSchema: {
        ...ProjectRefFields,
        out_path: z.string().describe('Путь выходного файла (.json или .nc)'),
        nc_out_path: z.string().optional().describe('Опционально: одновременно записать второй файл .nc'),
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );
        const writtenPath = maybePersist(loaded.project, args.out_path);
        const ncWrittenPath = args.nc_out_path ? maybePersist(loaded.project, args.nc_out_path) : undefined;
        rememberSession(loaded.project, writtenPath);
        return okResult({
          writtenPath,
          ...(ncWrittenPath ? { ncWrittenPath } : {}),
          objectCount: loaded.project.objects.length,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 6. project_preview — самодостаточный SVG-снимок геометрии, траектории и (опционально) фото-подложки
  server.registerTool(
    'project_preview',
    {
      title: 'Сгенерировать SVG-превью проекта (+ фото-подложка)',
      description:
        'Рендерит SVG чертежа в точности в осях редактора (Y слева→направо, X сверху→вниз) с сеткой, листом ДСП, подписями id и глубин, опциональной траекторией холостых ходов и наложением поверх локального фото изголовья (background_image_path) без Playwright и matplotlib.',
      inputSchema: {
        ...ProjectRefFields,
        out_path: z.string().optional().describe('Путь для записи .svg на диск'),
        width_px: z.number().int().min(320).max(2400).optional(),
        height_px: z.number().int().min(320).max(2400).optional(),
        show_toolpath: z.boolean().optional(),
        show_labels: z.boolean().optional(),
        show_grid: z.boolean().optional(),
        background_image_path: z.string().optional().describe('Локальный путь к фото изголовья для наложения под контур'),
        background_opacity: z.number().min(0.05).max(1).optional(),
        background_bounds: z
          .object({ minX: z.number(), maxX: z.number(), minY: z.number(), maxY: z.number() })
          .optional()
          .describe('Мировые границы фото-подложки (по умолчанию — лист stockSheet)'),
        return_svg_inline: z.boolean().optional().describe('Вернуть полный текст SVG в ответе (по умолчанию true, если out_path не задан)'),
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );
        const rendered = renderProjectSvg(loaded.project, {
          widthPx: args.width_px,
          heightPx: args.height_px,
          showToolpath: args.show_toolpath,
          showLabels: args.show_labels,
          showGrid: args.show_grid,
          backgroundImagePath: args.background_image_path,
          backgroundOpacity: args.background_opacity,
          backgroundBounds: args.background_bounds,
        });
        const writtenPath = args.out_path ? writeTextSafe(args.out_path, rendered.svg) : undefined;
        const includeSvg = args.return_svg_inline ?? !writtenPath;
        return okResult({
          ...(writtenPath ? { writtenPath } : {}),
          svgBytes: Buffer.byteLength(rendered.svg, 'utf8'),
          viewWorld: rendered.viewWorld,
          warningCount: rendered.warningCount,
          stats: {
            ...rendered.stats,
            cutLengthFormatted: formatDistanceRu(rendered.stats.cutLengthMm),
            rapidLengthFormatted: formatDistanceRu(rendered.stats.rapidLengthMm),
            durationFormatted: formatDurationRu(rendered.stats.estimatedSeconds),
          },
          ...(includeSvg ? { svg: rendered.svg } : {}),
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 7. gcode_generate — генерация G-кода + статистика + предупреждения
  server.registerTool(
    'gcode_generate',
    {
      title: 'Сгенерировать G-код',
      description:
        'Генерирует G-код тем же generator.ts, что и редактор; считает статистику и предупреждения. Опционально сохраняет .nc на диск.',
      inputSchema: {
        ...ProjectRefFields,
        embed_project: z.boolean().optional().describe('Добавить строку ; NCSTUDIO_PROJECT:{...} в конец файла (по умолчанию true при записи .nc)'),
        out_path: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );
        if (loaded.project.objects.filter((o) => o.visible !== false).length === 0) {
          throw new McpToolError('E_NO_OBJECTS', 'В проекте нет видимых объектов для генерации G-кода');
        }
        const ser = serializeProjectToNC(loaded.project);
        const validation = buildValidationReport(loaded.project);
        const embed = args.embed_project ?? Boolean(args.out_path);
        const outputText = embed ? ser.ncContent : ser.gcode;
        const writtenPath = args.out_path ? writeTextSafe(args.out_path, outputText) : undefined;
        return okResult({
          lineCount: ser.gcode.split('\n').length,
          segmentCount: ser.segments.length,
          stats: validation.stats,
          warnings: validation.warnings,
          outOfBounds: validation.bounds.outOfBounds,
          ...(writtenPath ? { writtenPath } : {}),
          gcode: outputText,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 8. gcode_parse — разбор G-кода в CAD-объекты и сегменты
  server.registerTool(
    'gcode_parse',
    {
      title: 'Разобрать G-код в фигуры и сегменты',
      description: 'Разбирает текст или файл G-кода в массив CADObject и сегменты траектории.',
      inputSchema: {
        file_path: z.string().optional(),
        content: z.string().optional(),
        source: z.string().optional(),
        work_offset: Point2DSchema.optional(),
      },
    },
    async (args) => {
      try {
        let text = args.content;
        if (text === undefined && args.file_path) {
          const resolved = path.resolve(args.file_path);
          if (!fs.existsSync(resolved)) {
            throw new McpToolError('E_FILE_NOT_FOUND', `Файл не найден: ${resolved}`);
          }
          text = fs.readFileSync(resolved, 'utf8');
        } else if (text === undefined && args.source) {
          const maybePath = path.resolve(args.source);
          text = !args.source.includes('\n') && fs.existsSync(maybePath)
            ? fs.readFileSync(maybePath, 'utf8')
            : args.source;
        }
        if (!text || !text.trim()) {
          throw new McpToolError('E_BAD_SOURCE', 'Не передан G-код (file_path / content / source)');
        }
        const objects = parseGcodeToCadObjects(text, [], args.work_offset);
        const segments = parseGcodeToSegments(text);
        return okResult({
          objectCount: objects.length,
          segmentCount: segments.length,
          objects,
          segments,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 9. gcode_stats — расчёт длин и времени обработки по G-коду
  server.registerTool(
    'gcode_stats',
    {
      title: 'Статистика G-кода (длины и время)',
      description: 'Вычисляет длину рабочего реза, холостых переездов, число сверлений и время обработки.',
      inputSchema: {
        file_path: z.string().optional(),
        content: z.string().optional(),
        source: z.string().optional(),
        machine: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async (args) => {
      try {
        let text = args.content;
        if (text === undefined && args.file_path) {
          const resolved = path.resolve(args.file_path);
          if (!fs.existsSync(resolved)) {
            throw new McpToolError('E_FILE_NOT_FOUND', `Файл не найден: ${resolved}`);
          }
          text = fs.readFileSync(resolved, 'utf8');
        } else if (text === undefined && args.source) {
          const maybePath = path.resolve(args.source);
          text = !args.source.includes('\n') && fs.existsSync(maybePath)
            ? fs.readFileSync(maybePath, 'utf8')
            : args.source;
        }
        if (!text || !text.trim()) {
          throw new McpToolError('E_BAD_SOURCE', 'Не передан G-код для расчёта статистики');
        }
        const segments = parseGcodeToSegments(text);
        const machine: MachineSettings = {
          ...INITIAL_MACHINE,
          ...((args.machine as Partial<MachineSettings> | undefined) ?? {}),
        };
        const stats = computeToolpathStats(segments, machine);
        return okResult({
          segmentCount: segments.length,
          stats: {
            ...stats,
            cutLengthFormatted: formatDistanceRu(stats.cutLengthMm),
            rapidLengthFormatted: formatDistanceRu(stats.rapidLengthMm),
            durationFormatted: formatDurationRu(stats.estimatedSeconds),
          },
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 10. toolpath_optimize — оптимизация порядка обхода (NN + 2-opt)
  server.registerTool(
    'toolpath_optimize',
    {
      title: 'Оптимизировать маршрут (NN + 2-opt)',
      description:
        'Переставляет и при необходимости разворачивает фигуры алгоритмом optimizeCADObjects (жадный NN + 2-opt), сокращая холостые переезды.',
      inputSchema: {
        ...ProjectRefFields,
        out_path: z.string().optional(),
        save_in_place: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );
        if (loaded.project.objects.length === 0) {
          throw new McpToolError('E_NO_OBJECTS', 'В проекте нет объектов для оптимизации');
        }
        const off = loaded.project.machine.workOffset;
        const opt = optimizeCADObjects(loaded.project.objects, { x: -off.x, y: -off.y });
        const nextProject: ProjectData = {
          ...loaded.project,
          objects: opt.optimizedObjects,
        };
        const saveTarget = args.out_path ?? (args.save_in_place ? loaded.filePath : undefined);
        const writtenPath = maybePersist(nextProject, saveTarget);
        rememberSession(nextProject, writtenPath ?? loaded.filePath);
        return okResult({
          beforeRapidMm: opt.initialDistance,
          afterRapidMm: opt.optimizedDistance,
          savedMm: opt.savedDistance,
          savedPercentage: opt.savedPercentage,
          reorderedCount: opt.reorderedCount,
          flippedCount: opt.flippedCount,
          estimatedTimeSavedSec: opt.estimatedTimeSavedSec,
          ...(writtenPath ? { writtenPath } : {}),
          project: nextProject,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 11. project_validate — полная проверка границ, глубин Z и предупреждений станка
  server.registerTool(
    'project_validate',
    {
      title: 'Проверить проект (границы, Z, предупреждения)',
      description:
        'Запускает analyzeProjectWarnings + analyzeTrajectoryBounds по реальной траектории G-кода (включая вылет дуг!). Возвращает ok, список warnings, точные границы траектории и статистику.',
      inputSchema: {
        ...ProjectRefFields,
        strict_bounds: z.boolean().optional().describe('Если true — возвращать isError с кодом E_OUT_OF_BOUNDS при выходе за пределы станка'),
      },
    },
    async (args) => {
      try {
        const loaded = loadProjectInput(
          {
            file_path: args.file_path,
            content: args.content,
            project: args.project as unknown as ProjectData | undefined,
            source: args.source,
          },
          session
        );
        const report = buildValidationReport(loaded.project);
        if (args.strict_bounds && report.bounds.outOfBounds) {
          throw new McpToolError(
            'E_OUT_OF_BOUNDS',
            'Траектория выходит за границы рабочего поля станка',
            { bounds: report.bounds, warnings: report.warnings }
          );
        }
        return okResult(report);
      } catch (err) {
        return errResult(err);
      }
    }
  );

  // 12. vector_import — импорт DXF / SVG в фигуры или прямо в проект
  server.registerTool(
    'vector_import',
    {
      title: 'Импорт DXF / SVG',
      description:
        'Парсит локальный файл или содержимое DXF/SVG (parseDXFContent / parseSVGContent), применяет масштаб, автостыковку контуров и размещение на листе ДСП.',
      inputSchema: {
        file_path: z.string().optional(),
        content: z.string().optional(),
        format: z.enum(['dxf', 'svg']).optional().describe('Определяется по расширению file_path, либо указывается явно для content'),
        scale: z.number().positive().optional(),
        auto_join: z.boolean().optional(),
        placement: z.enum(['sheetCenter', 'sheetMargin', 'asIs']).optional(),
        margin_mm: z.number().optional(),
        default_depth: z.number().positive().optional(),
        merge_into_session: z.boolean().optional().describe('Добавить импортированные фигуры в активный проект сессии (или создать новый head-проект)'),
        out_path: z.string().optional().describe('Если указан — записать получившийся проект (.json/.nc)'),
      },
    },
    async (args) => {
      try {
        let rawContent = args.content;
        let fmt = args.format;
        let baseName = 'Импорт';
        if (rawContent === undefined && args.file_path) {
          const resolved = path.resolve(args.file_path);
          if (!fs.existsSync(resolved)) {
            throw new McpToolError('E_FILE_NOT_FOUND', `Файл не найден: ${resolved}`);
          }
          rawContent = fs.readFileSync(resolved, 'utf8');
          baseName = path.basename(resolved, path.extname(resolved));
          if (!fmt) {
            const ext = path.extname(resolved).toLowerCase();
            if (ext === '.dxf') fmt = 'dxf';
            else if (ext === '.svg') fmt = 'svg';
          }
        }
        if (!rawContent || !fmt) {
          throw new McpToolError(
            'E_BAD_SOURCE',
            'Укажите file_path (.dxf/.svg) или content + format ("dxf" | "svg")'
          );
        }

        const summary = fmt === 'dxf' ? parseDXFContent(rawContent) : parseSVGContent(rawContent);
        const baseMachine = session.project?.machine ?? INITIAL_MACHINE;
        const prepared = prepareVectorImportObjects(summary, {
          scale: args.scale ?? 1,
          autoJoin: args.auto_join ?? true,
          placement: args.placement ?? 'sheetCenter',
          marginMm: args.margin_mm ?? 20,
          defaultDepth: args.default_depth ?? baseMachine.cutDepth ?? 17.5,
          stockSheet: baseMachine.stockSheet,
        });

        const createdObjects: CADObject[] = prepared.map((o) => ({
          ...o,
          id: o.id || createObjectId('vec'),
        })) as CADObject[];

        let writtenPath: string | undefined;
        if (args.merge_into_session || args.out_path) {
          const targetProject = session.project
            ? structuredClone(session.project)
            : createNewProject({ name: baseName, mode: 'head' });
          targetProject.objects.push(...createdObjects);
          writtenPath = maybePersist(targetProject, args.out_path);
          rememberSession(targetProject, writtenPath ?? session.filePath);
        }

        return okResult({
          format: fmt,
          counts: summary.counts,
          warnings: summary.warnings,
          importedCount: createdObjects.length,
          ...(writtenPath ? { writtenPath } : {}),
          objects: createdObjects,
        });
      } catch (err) {
        return errResult(err);
      }
    }
  );

  return { server, session };
}

// Запуск по stdio только при прямом вызове файла (не при импорте в тестах)
const isDirectRun = (() => {
  try {
    const thisFile = path.resolve(fileURLToPath(import.meta.url));
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return thisFile === entry;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  const { server } = createEzncMcpServer();
  const transport = new StdioServerTransport();
  server
    .connect(transport)
    .then(() => {
      logStderr('EZNC Studio MCP server v2.0.0 ready on stdio (12 tools)');
    })
    .catch((err) => {
      logStderr(`Fatal startup error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      process.exit(1);
    });
}

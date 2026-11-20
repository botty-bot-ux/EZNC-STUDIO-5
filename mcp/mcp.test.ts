import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEzncMcpServer } from './server.ts';
import {
  McpToolError,
  applyCadOperation,
  buildValidationReport,
  createNewProject,
  patchProject,
  renderProjectSvg,
  resolveSafeOutPath,
  serializeProjectToNC,
} from './helpers.ts';
import { extractProjectDataFromNC } from '../src/lib/gcode/parser.ts';

function parseToolJson(result: { content: Array<{ type: string; text?: string }>; isError?: boolean }) {
  const txt = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(txt) as Record<string, unknown>;
}

describe('MCP helpers: create, mixed depths, fillet, mirror, preview, sandbox', () => {
  it('создаёт проект изголовья с автоматическим useOwnDepth для пазов 4 мм на листе 17.5 мм', () => {
    const proj = createNewProject({
      name: 'Изголовье тест',
      mode: 'head',
      sheetWidthY: 1680,
      sheetHeightX: 1080,
      objects: [
        {
          id: 'outer_top',
          name: 'Верх контура',
          type: 'line',
          startX: -1080,
          startY: -1680,
          endX: -1080,
          endY: 0,
          depth: 17.5,
        },
        {
          id: 'seam_mid',
          name: 'Декоративный шов',
          type: 'line',
          startX: -540,
          startY: -1680,
          endX: -540,
          endY: 0,
          depth: 4,
        },
      ],
    });

    expect(proj.machine.cutDepth).toBe(17.5);
    expect(proj.objects[0].useOwnDepth).toBeUndefined();
    expect(proj.objects[1].useOwnDepth).toBe(true);

    const { gcode, ncContent } = serializeProjectToNC(proj);
    expect(gcode).toContain('Z-17.500');
    expect(gcode).toContain('Z-4.000');

    // Round-trip .nc сохраняет useOwnDepth и оба id
    const restored = extractProjectDataFromNC(ncContent);
    expect(restored?.objects.map((o) => o.id)).toEqual(['outer_top', 'seam_mid']);
    expect(restored?.objects[1].useOwnDepth).toBe(true);
  });

  it('fillet_lines строит внутреннюю дугу скругления без вылета за габариты панели (регрессия задания 2)', () => {
    const proj = createNewProject({
      mode: 'head',
      sheetWidthY: 1680,
      sheetHeightX: 1080,
      objects: [
        { id: 'top', type: 'line', startX: -1080, startY: -1680, endX: -1080, endY: 0 },
        { id: 'right', type: 'line', startX: -1080, startY: 0, endX: 0, endY: 0 },
      ],
    });

    const { project: filleted } = applyCadOperation(proj, {
      op: 'fillet_lines',
      id_a: 'top',
      id_b: 'right',
      radius: 30,
    });

    expect(filleted.objects).toHaveLength(3);
    const arc = filleted.objects.find((o) => o.type === 'arc');
    expect(arc).toBeDefined();
    const report = buildValidationReport(filleted);
    expect(report.ok).toBe(true);
    expect(report.bounds.outOfBounds).toBe(false);
    // Дуга строго внутри [-1080..0, -1680..0] — без выступа +30 мм наружу!
    expect(report.bounds.trajMinX).toBeGreaterThanOrEqual(-1080.01);
    expect(report.bounds.trajMaxY).toBeLessThanOrEqual(0.01);
  });

  it('patchProject поддерживает arc_3pt и структурную ошибку E_OBJECT_NOT_FOUND', () => {
    const proj = createNewProject({ mode: 'head' });
    const patched = patchProject(proj, {
      add: [
        {
          id: 'arch_1',
          type: 'arc_3pt',
          start: { x: -400, y: -1200 },
          through: { x: -700, y: -800 },
          end: { x: -400, y: -400 },
        },
      ],
    });
    expect(patched.addedIds).toEqual(['arch_1']);
    expect(patched.project.objects[0].type).toBe('arc');

    expect(() =>
      patchProject(patched.project, { remove_ids: ['non_existent'] })
    ).toThrowError(McpToolError);
    try {
      patchProject(patched.project, { remove_ids: ['non_existent'] });
    } catch (e) {
      expect((e as McpToolError).code).toBe('E_OBJECT_NOT_FOUND');
    }
  });

  it('renderProjectSvg генерирует валидный SVG с подложкой-картинкой и траекторией', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eznc-mcp-'));
    const tinyPngPath = path.join(tmpDir, 'ref.png');
    // 1x1 transparent PNG
    fs.writeFileSync(
      tinyPngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
    );
    const proj = createNewProject({
      mode: 'head',
      sheetWidthY: 1680,
      sheetHeightX: 1080,
      objects: [
        { id: 'r1', type: 'rectangle', x: -1080, y: -1680, width: 1080, height: 1680, cornerRadius: 20 },
        { id: 's1', type: 'line', startX: -540, startY: -1680, endX: -540, endY: 0, depth: 4 },
      ],
    });
    const res = renderProjectSvg(proj, {
      backgroundImagePath: tinyPngPath,
      backgroundOpacity: 0.45,
      showToolpath: true,
    });
    expect(res.svg).toContain('<svg ');
    expect(res.svg).toContain('data:image/png;base64,');
    expect(res.svg).toContain('r1 (Z-17.5)');
    expect(res.svg).toContain('s1 (Z-4)');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolveSafeOutPath блокирует запись за пределы EZNC_OUT_DIR с кодом E_PATH_FORBIDDEN', () => {
    const root = path.join(os.tmpdir(), 'eznc-sandbox-test');
    expect(resolveSafeOutPath(path.join(root, 'demo/out.nc'), root)).toBe(
      path.resolve(root, 'demo/out.nc')
    );
    try {
      resolveSafeOutPath(path.join(root, '../escape.nc'), root);
      expect.unreachable('должна быть ошибка E_PATH_FORBIDDEN');
    } catch (e) {
      expect(e).toBeInstanceOf(McpToolError);
      expect((e as McpToolError).code).toBe('E_PATH_FORBIDDEN');
    }
  });
});

describe('MCP SDK live handshake (InMemoryTransport)', () => {
  it('регистрирует 12 инструментов и выполняет сквозной сценарий с состоянием сессии', async () => {
    const { server } = createEzncMcpServer();
    const client = new Client({ name: 'vitest-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'cad_operate',
      'gcode_generate',
      'gcode_parse',
      'gcode_stats',
      'project_create',
      'project_open',
      'project_patch',
      'project_preview',
      'project_validate',
      'project_write',
      'toolpath_optimize',
      'vector_import',
    ]);

    // 1. Создать проект с нуля в сессии
    const createdRes = await client.callTool({
      name: 'project_create',
      arguments: {
        name: 'Изголовье SDK',
        mode: 'head',
        sheet_width_y: 1680,
        sheet_height_x: 1080,
        objects: [
          { id: 'l_left', type: 'line', startX: -1080, startY: -1680, endX: 0, endY: -1680 },
          { id: 'l_top', type: 'line', startX: -1080, startY: -1680, endX: -1080, endY: -840 },
        ],
      },
    });
    const created = parseToolJson(createdRes as never);
    expect(created.ok).toBe(true);
    expect(created.objectCount).toBe(2);

    // 2. Скругление угла и зеркальная копия — без повторной передачи файла (берёт активную сессию!)
    const filletRes = await client.callTool({
      name: 'cad_operate',
      arguments: { op: 'fillet_lines', id_a: 'l_left', id_b: 'l_top', radius: 25 },
    });
    expect(parseToolJson(filletRes as never).ok).toBe(true);

    const mirrorRes = await client.callTool({
      name: 'cad_operate',
      arguments: {
        op: 'mirror',
        axis: 'y',
        anchor: { x: -540, y: -840 },
        copy: true,
      },
    });
    const mirrored = parseToolJson(mirrorRes as never);
    expect(mirrored.ok).toBe(true);
    expect(mirrored.objectCount).toBe(6);

    // 3. Валидация + SVG-превью из активной сессии
    const valRes = await client.callTool({ name: 'project_validate', arguments: {} });
    const val = parseToolJson(valRes as never);
    expect(val.ok).toBe(true);

    const prevRes = await client.callTool({ name: 'project_preview', arguments: {} });
    const prev = parseToolJson(prevRes as never);
    expect(prev.ok).toBe(true);
    expect(typeof prev.svg).toBe('string');

    // 4. Проверка структурированного кода ошибки при неверном id
    const badRes = await client.callTool({
      name: 'project_patch',
      arguments: { remove_ids: ['missing_id'] },
    });
    expect((badRes as { isError?: boolean }).isError).toBe(true);
    const badJson = parseToolJson(badRes as never);
    expect(badJson.code).toBe('E_OBJECT_NOT_FOUND');

    await Promise.all([client.close(), server.close()]);
  });
});

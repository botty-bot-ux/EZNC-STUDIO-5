import { CADObject, MachineSettings, OperationItem, WarningItem } from '../../types';

import { isPointWithinBounds, transformProgramToMachine } from '../geometry/transform';

export function analyzeProjectWarnings(
  objects: CADObject[],
  operations: OperationItem[],
  machine: MachineSettings
): WarningItem[] {
  const warnings: WarningItem[] = [];

  // 1. Machine settings checks
  if (machine.safeZ <= 0) {
    warnings.push({
      id: 'warn_safe_z',
      level: 'error',
      title: 'Небезопасная высота Z',
      message: 'Безопасная высота Z равна 0 или отрицательна. Задайте положительное значение (например, 10 мм).',
    });
  }

  if (machine.feedCut <= 0) {
    warnings.push({
      id: 'warn_feed_cut',
      level: 'error',
      title: 'Нулевая подача резания',
      message: 'Подача резания (feedCut) не задана или равна 0.',
    });
  }

  if (machine.feedPlunge <= 0) {
    warnings.push({
      id: 'warn_feed_plunge',
      level: 'error',
      title: 'Нулевая подача врезания',
      message: 'Подача врезания по оси Z (feedPlunge) не задана или равна 0.',
    });
  }

  if (machine.spindleSpeed <= 0) {
    warnings.push({
      id: 'warn_spindle',
      level: 'warning',
      title: 'Шпиндель выключен',
      message: 'Обороты шпинделя равны 0. Убедитесь, что шпиндель запускается вручную.',
    });
  }

  // 2. Objects out of bounds checks
  for (const obj of objects) {
    const pointsToCheck: { x: number; y: number }[] = [];

    if (obj.type === 'point') {
      pointsToCheck.push({ x: obj.x, y: obj.y });
    } else if (obj.type === 'line') {
      pointsToCheck.push({ x: obj.startX, y: obj.startY });
      pointsToCheck.push({ x: obj.endX, y: obj.endY });
    } else if (obj.type === 'polyline') {
      pointsToCheck.push(...obj.points);
    } else if (obj.type === 'rectangle') {
      pointsToCheck.push({ x: obj.x, y: obj.y });
      pointsToCheck.push({ x: obj.x + obj.width, y: obj.y });
      pointsToCheck.push({ x: obj.x + obj.width, y: obj.y + obj.height });
      pointsToCheck.push({ x: obj.x, y: obj.y + obj.height });
    } else if (obj.type === 'circle') {
      const r = obj.radius;
      pointsToCheck.push({ x: obj.centerX - r, y: obj.centerY - r });
      pointsToCheck.push({ x: obj.centerX + r, y: obj.centerY + r });
    } else if (obj.type === 'arc') {
      pointsToCheck.push({ x: obj.startX, y: obj.startY });
      pointsToCheck.push({ x: obj.endX, y: obj.endY });
    }

    let isOutOfBounds = false;
    for (const p of pointsToCheck) {
      const mPt = transformProgramToMachine(p, machine);
      if (!isPointWithinBounds(mPt, machine)) {
        isOutOfBounds = true;
      }
    }

    if (isOutOfBounds) {
      warnings.push({
        id: `warn_bound_${obj.id}`,
        level: 'error',
        title: `Выход за пределы: ${obj.name}`,
        message: `Объект "${obj.name}" (или его часть) выходит за границы рабочей зоны станка [${machine.bounds.xMin}..${machine.bounds.xMax}, ${machine.bounds.yMin}..${machine.bounds.yMax}].`,
        objectId: obj.id,
      });
    }

    // Check tool diameter vs circle/hole
    if (obj.type === 'point' && obj.diameter < machine.toolDiameter) {
      warnings.push({
        id: `warn_tool_hole_${obj.id}`,
        level: 'warning',
        title: `Диаметр инструмента: ${obj.name}`,
        message: `Диаметр отверстия (${obj.diameter}мм) меньше диаметра инструмента (${machine.toolDiameter}мм).`,
        objectId: obj.id,
      });
    }
  }

  // 3. Operations checks
  const activeOps = operations.filter((op) => op.enabled);
  for (const op of activeOps) {
    if (op.linkedObjectIds.length === 0) {
      warnings.push({
        id: `warn_op_empty_${op.id}`,
        level: 'warning',
        title: `Пустая операция: ${op.name}`,
        message: `Операция "${op.name}" включена, но к ней не привязан ни один объект.`,
      });
    }

    if (op.finalDepth === 0) {
      warnings.push({
        id: `warn_op_depth_${op.id}`,
        level: 'warning',
        title: `Нулевая глубина: ${op.name}`,
        message: `Операция "${op.name}" имеет глубину 0 мм. Резка не будет заглубляться.`,
      });
    }
  }

  return warnings;
}

import React from 'react';
import {
  Circle,
  CircleDot,
  CornerUpRight,
  LineDotRightHorizontal,
  MousePointer,
  Ruler,
  Scissors,
  Spline,
  Square,
} from 'lucide-react';
import { ActiveTool } from '../../types';

export interface ToolDef {
  id: ActiveTool;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortLabel: string;
  shortcut: string;
  title: string;
}

/**
 * Единый реестр инструментов 2D-черчения для боковой панели (ToolRail)
 * и мобильной шапки (Header). В режиме «Царга» показывается «Отверстие»,
 * в режиме «Изголовье» — «Дуга».
 */
export function getToolDefs(isRail: boolean): ToolDef[] {
  const all: Array<ToolDef & { show: boolean }> = [
    {
      id: 'select',
      Icon: MousePointer,
      label: 'Выбор',
      shortLabel: 'Выбор',
      shortcut: 'S',
      title: 'Выбор и перемещение объектов (S)',
      show: true,
    },
    {
      id: 'line',
      Icon: LineDotRightHorizontal,
      label: 'Линия',
      shortLabel: 'Линия',
      shortcut: 'L',
      title: 'Отрезок, полилиния или контур (L) · Shift = 90°/45°',
      show: true,
    },
    {
      id: 'point',
      Icon: CircleDot,
      label: 'Отверстие',
      shortLabel: 'Отверст.',
      shortcut: 'H',
      title: 'Сверление отверстия (H)',
      show: isRail,
    },
    {
      id: 'arc',
      Icon: Spline,
      label: 'Дуга',
      shortLabel: 'Дуга',
      shortcut: 'A',
      title: 'Дуга окружности (A) · 3 точки, прогиб или центр',
      show: !isRail,
    },
    {
      id: 'rectangle',
      Icon: Square,
      label: 'Прямоугольник',
      shortLabel: 'Прямоуг.',
      shortcut: 'R',
      title: 'Прямоугольник по двум углам (R)',
      show: true,
    },
    {
      id: 'circle',
      Icon: Circle,
      label: 'Окружность',
      shortLabel: 'Круг',
      shortcut: 'C',
      title: 'Окружность по центру и радиусу (C)',
      show: true,
    },
    {
      id: 'trim',
      Icon: Scissors,
      label: 'Ножницы',
      shortLabel: 'Обрезка',
      shortcut: 'T',
      title: 'Ножницы — обрезка линий, дуг и окружностей по пересечениям (T)',
      show: true,
    },
    {
      id: 'fillet',
      Icon: CornerUpRight,
      label: 'Скругление',
      shortLabel: 'Скругл.',
      shortcut: 'G',
      title: 'Скругление углов линий и прямоугольников (G)',
      show: true,
    },
    {
      id: 'measure',
      Icon: Ruler,
      label: 'Замер',
      shortLabel: 'Замер',
      shortcut: 'M',
      title: 'Штангенциркуль — измерение расстояний и углов (M)',
      show: true,
    },
  ];

  return all.filter((t) => t.show).map(({ show: _show, ...def }) => def);
}

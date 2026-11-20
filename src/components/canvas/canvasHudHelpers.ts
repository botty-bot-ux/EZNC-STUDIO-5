import { ActiveTool } from '../../types';

export function activeToolLabel(tool: ActiveTool): string | null {
  switch (tool) {
    case 'line':
      return 'Линия';
    case 'rectangle':
      return 'Прямоугольник';
    case 'circle':
      return 'Окружность';
    case 'arc':
      return 'Дуга';
    case 'point':
      return 'Отверстие';
    case 'measure':
      return 'Замер';
    case 'trim':
      return 'Ножницы';
    case 'fillet':
      return 'Скругление';
    default:
      return null;
  }
}

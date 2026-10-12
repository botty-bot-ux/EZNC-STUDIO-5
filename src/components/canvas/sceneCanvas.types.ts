import { CADObject, Point2D } from '../../types';

export interface SceneCanvasProps {
  onCursorMove?: (pt: Point2D | null) => void;
}

/**
 * Единый «курсор» для мыши и касаний: все обработчики холста работают с этим
 * типизированным минимумом, поэтому тач и мышь проходят один и тот же код.
 */
export interface CanvasPointer {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  button?: number;
}

// Live, uncommitted drag state. During a drag we only touch this local state and
// redraw from it; the store is mutated exactly once on mouseup (see handleMouseUp).
// `edit` — групповое перемещение узла: патчим все подходящие фигуры сразу (см. pointerMove),
// чтобы при нескольких выделенных фигурах с общим узлом он тянулся за всеми.
export type LiveDrag =
  | { mode: 'none' }
  | { mode: 'translate'; dx: number; dy: number; ids: string[] }
  | { mode: 'edit'; items: Array<{ id: string; patch: Partial<CADObject> }> };

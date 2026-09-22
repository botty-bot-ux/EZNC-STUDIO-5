import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../store/useProjectStore';
import { ArcObject, LineObject } from '../../types';
import {
  computeObjectBounds,
  computeParallelArcs,
  computeParallelSegments,
} from '../../lib/geometry/transform';
import { MoveDialog } from '../modals/MoveDialog';
import { ParallelDialog } from '../modals/ParallelDialog';
import { ScaleDialog } from '../modals/ScaleDialog';

/**
 * Хост модалок действий с фигурами на уровне App. Открывается по store.shapeDialog
 * из двух мест: кнопки в шапке панели «Свойства» и правый-кликовое меню на холсте.
 * Живёт выше обоих, чтобы модалка не зависела от того, открыта ли панель свойств.
 */
export const ShapeActionsHost: React.FC = () => {
  const {
    shapeDialog,
    objects,
    selectedObjectIds,
    addObject,
    moveSelectedObjectsBy,
    scaleSelectedObjectsBy,
    setShapeDialog,
  } = useProjectStore(
    useShallow((s) => ({
      shapeDialog: s.shapeDialog,
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      addObject: s.addObject,
      moveSelectedObjectsBy: s.moveSelectedObjectsBy,
      scaleSelectedObjectsBy: s.scaleSelectedObjectsBy,
      setShapeDialog: s.setShapeDialog,
    }))
  );

  const selObjs = objects.filter((o) => selectedObjectIds.includes(o.id));
  // «Основная» фигура = последний id выделения (как в панели Свойств).
  const primary = selObjs[selObjs.length - 1];

  // Смена выделения «во время полёта» могла сделать запрос невыполнимым — снимаем его.
  useEffect(() => {
    if (!shapeDialog) return;
    if (
      shapeDialog.kind === 'parallel' &&
      (!primary || (primary.type !== 'line' && primary.type !== 'arc'))
    ) {
      setShapeDialog(null);
    }
  }, [shapeDialog, primary, setShapeDialog]);

  if (!shapeDialog) return null;

  const close = () => setShapeDialog(null);

  if (shapeDialog.kind === 'move') {
    return (
      <MoveDialog
        isOpen
        ids={selObjs.filter((o) => !o.frozen).map((o) => o.id)}
        onClose={close}
        onApply={moveSelectedObjectsBy}
      />
    );
  }

  if (shapeDialog.kind === 'scale') {
    const movable = selObjs.filter((o) => !o.frozen);
    // Якорь — центр общей рамки выделения: фигура растягивается симметрично
    // относительно середины, группа не «уезжает» в сторону.
    let anchor = { x: 0, y: 0 };
    if (movable.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const o of movable) {
        const b = computeObjectBounds(o);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
      anchor = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
    return (
      <ScaleDialog
        isOpen
        ids={movable.map((o) => o.id)}
        anchor={anchor}
        onClose={close}
        onApply={scaleSelectedObjectsBy}
      />
    );
  }

  if (primary?.type === 'arc') {
    const a = primary as ArcObject;
    const arcSource = {
      centerX: a.centerX,
      centerY: a.centerY,
      radius: a.radius,
      startX: a.startX,
      startY: a.startY,
      endX: a.endX,
      endY: a.endY,
      clockwise: a.clockwise,
    };
    return (
      <ParallelDialog
        isOpen
        title="Параллельная дуга"
        countLabel="Кол-во дуг"
        hint={`От исходной «${a.name}» концентрически. Знак «−» — к центру.`}
        onClose={close}
        makePreview={(distance, count) => {
          const arcs = computeParallelArcs(arcSource, distance, count);
          return arcs.length ? { segments: [], sourceArc: arcSource, arcs } : null;
        }}
        onCreate={(distance, count) => {
          const baseIndex = objects.length;
          computeParallelArcs(arcSource, distance, count).forEach((arc, i) => {
            addObject({
              type: 'arc',
              name: `Дуга R${arc.radius.toFixed(1)} (${baseIndex + i + 1})`,
              depth: a.depth,
              operationType: a.operationType,
              color: a.color,
              visible: true,
              centerX: arc.centerX,
              centerY: arc.centerY,
              radius: arc.radius,
              startX: arc.startX,
              startY: arc.startY,
              endX: arc.endX,
              endY: arc.endY,
              clockwise: arc.clockwise,
            });
          });
        }}
      />
    );
  }

  if (primary?.type === 'line') {
    const l = primary as LineObject;
    const lineSource = { startX: l.startX, startY: l.startY, endX: l.endX, endY: l.endY };
    return (
      <ParallelDialog
        isOpen
        title="Параллельная линия"
        countLabel="Кол-во линий"
        hint={`От исходной «${l.name}» по нормали. Знак «−» меняет сторону.`}
        onClose={close}
        makePreview={(distance, count) => {
          const segments = computeParallelSegments(lineSource, distance, count);
          return segments.length ? { segments, source: lineSource } : null;
        }}
        onCreate={(distance, count) => {
          const baseIndex = objects.length;
          computeParallelSegments(lineSource, distance, count).forEach((seg, i) => {
            addObject({
              type: 'line',
              name: `Отрезок ${baseIndex + i + 1}`,
              depth: l.depth,
              operationType: l.operationType,
              color: l.color,
              visible: true,
              startX: seg.startX,
              startY: seg.startY,
              endX: seg.endX,
              endY: seg.endY,
            });
          });
        }}
      />
    );
  }

  return null;
};

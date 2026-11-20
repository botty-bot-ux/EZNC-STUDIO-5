import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getLastSelectedId, useProjectStore } from '../../store/useProjectStore';
import { ArcObject, LineObject } from '../../types';
import {
  computeObjectsBounds,
  computeParallelArcs,
  computeParallelSegments,
} from '../../lib/geometry/transform';
import { ArrayDialog } from '../modals/ArrayDialog';
import { MoveDialog } from '../modals/MoveDialog';
import { ParallelDialog } from '../modals/ParallelDialog';
import { RotateDialog } from '../modals/RotateDialog';
import { ScaleDialog } from '../modals/ScaleDialog';
import { VectorImportModal } from '../modals/VectorImportModal';

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
    addObjectsBulk,
    moveSelectedObjectsBy,
    scaleSelectedObjectsBy,
    rotateSelectedObjectsByAngle,
    arraySelectedObjects,
    setShapeDialog,
  } = useProjectStore(
    useShallow((s) => ({
      shapeDialog: s.shapeDialog,
      objects: s.objects,
      selectedObjectIds: s.selectedObjectIds,
      addObjectsBulk: s.addObjectsBulk,
      moveSelectedObjectsBy: s.moveSelectedObjectsBy,
      scaleSelectedObjectsBy: s.scaleSelectedObjectsBy,
      rotateSelectedObjectsByAngle: s.rotateSelectedObjectsByAngle,
      arraySelectedObjects: s.arraySelectedObjects,
      setShapeDialog: s.setShapeDialog,
    }))
  );

  const selObjs = objects.filter((o) => selectedObjectIds.includes(o.id));
  // «Основная» фигура = последний id выделения (единый источник истины с панелью Свойств).
  const primaryId = getLastSelectedId(selectedObjectIds);
  const primary = primaryId ? selObjs.find((o) => o.id === primaryId) : undefined;

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
    const bounds = computeObjectsBounds(movable);
    // Якорь — центр общей рамки выделения: фигура растягивается симметрично
    // относительно середины, группа не «уезжает» в сторону.
    const anchor = bounds
      ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
      : { x: 0, y: 0 };
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

  if (shapeDialog.kind === 'rotate') {
    const movable = selObjs.filter((o) => !o.frozen);
    const bounds = computeObjectsBounds(movable);
    const selectionCenter = bounds
      ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
      : { x: 0, y: 0 };
    return (
      <RotateDialog
        isOpen
        ids={movable.map((o) => o.id)}
        selectionCenter={selectionCenter}
        hasRectangle={movable.some((o) => o.type === 'rectangle')}
        onClose={close}
        onApply={rotateSelectedObjectsByAngle}
      />
    );
  }

  if (shapeDialog.kind === 'import') {
    return <VectorImportModal isOpen onClose={close} />;
  }

  if (shapeDialog.kind === 'array') {
    return (
      <ArrayDialog
        isOpen
        selectedCount={selObjs.length}
        onClose={close}
        onApply={arraySelectedObjects}
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
          const batch = computeParallelArcs(arcSource, distance, count).map((arc, i) => ({
            type: 'arc' as const,
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
          }));
          addObjectsBulk(batch);
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
          const batch = computeParallelSegments(lineSource, distance, count).map((seg, i) => ({
            type: 'line' as const,
            name: `Отрезок ${baseIndex + i + 1}`,
            depth: l.depth,
            operationType: l.operationType,
            color: l.color,
            visible: true,
            startX: seg.startX,
            startY: seg.startY,
            endX: seg.endX,
            endY: seg.endY,
          }));
          addObjectsBulk(batch);
        }}
      />
    );
  }

  return null;
};

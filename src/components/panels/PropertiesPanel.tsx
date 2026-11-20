import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowLeft,
  Circle,
  CircleDot,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Layers,
  LineDotRightHorizontal,
  Lock,
  Spline,
  Square,
  Trash2,
  Unlock,
  Waypoints,
  X,
} from 'lucide-react';
import { useProjectStore, useSelectedObjectId } from '../../store/useProjectStore';
import {
  ArcObject,
  CADObject,
  CircleObject,
  LineObject,
  PointHoleObject,
  PolylineObject,
  RectangleObject,
} from '../../types';
import { InspectorSection } from '../ui/InspectorSection';
import { MachineSettingsPanel } from './MachineSettingsPanel';
import { ArcProperties } from './properties/ArcProperties';
import { CircleProperties } from './properties/CircleProperties';
import { LineProperties } from './properties/LineProperties';
import { MeasurePropertiesView } from './properties/MeasurePropertiesView';
import { PointProperties } from './properties/PointProperties';
import { PolylineProperties } from './properties/PolylineProperties';
import { RectangleProperties } from './properties/RectangleProperties';
import { StockAlignBlock } from './properties/StockAlignBlock';
import { TransformActionsGrid } from './properties/TransformActionsGrid';

function typeLabel(obj: CADObject): string {
  switch (obj.type) {
    case 'point':
      return 'Отверстие';
    case 'line':
      return 'Отрезок';
    case 'polyline':
      return obj.closed ? 'Замкнутый контур' : 'Полилиния';
    case 'rectangle':
      return 'Прямоугольник';
    case 'circle':
      return 'Окружность';
    case 'arc':
      return 'Дуга';
  }
}

function renderTypeIcon(type: CADObject['type']) {
  const cls = 'w-4 h-4 text-accent shrink-0';
  switch (type) {
    case 'point':
      return <CircleDot className={cls} />;
    case 'line':
      return <LineDotRightHorizontal className={cls} />;
    case 'polyline':
      return <Waypoints className={cls} />;
    case 'rectangle':
      return <Square className={cls} />;
    case 'circle':
      return <Circle className={cls} />;
    case 'arc':
      return <Spline className={cls} />;
  }
}

function getTelemetryPairs(selectedObj: CADObject): Array<{ label: string; value: string }> {
  if (selectedObj.type === 'line') {
    const l = selectedObj as LineObject;
    const len = Math.hypot(l.endX - l.startX, l.endY - l.startY);
    const angleDeg =
      ((Math.atan2(l.endY - l.startY, l.endX - l.startX) * 180) / Math.PI + 360) % 360;
    return [
      { label: 'Длина', value: `${len.toFixed(1)} мм` },
      { label: 'Угол', value: `${angleDeg.toFixed(1)}°` },
    ];
  }
  if (selectedObj.type === 'polyline') {
    const p = selectedObj as PolylineObject;
    let len = 0;
    for (let i = 0; i < p.points.length - 1; i++) {
      len += Math.hypot(p.points[i + 1].x - p.points[i].x, p.points[i + 1].y - p.points[i].y);
    }
    if (p.closed && p.points.length >= 2) {
      const first = p.points[0];
      const last = p.points[p.points.length - 1];
      len += Math.hypot(first.x - last.x, first.y - last.y);
    }
    return [
      { label: 'Периметр', value: `${len.toFixed(1)} мм` },
      { label: 'Узлов', value: `${p.points.length}` },
    ];
  }
  if (selectedObj.type === 'rectangle') {
    const r = selectedObj as RectangleObject;
    return [
      { label: 'Периметр', value: `${(2 * (r.width + r.height)).toFixed(1)} мм` },
      { label: 'Площадь', value: `${Math.round(r.width * r.height)} мм²` },
    ];
  }
  if (selectedObj.type === 'circle') {
    const c = selectedObj as CircleObject;
    return [
      { label: 'Диаметр', value: `Ø${(c.radius * 2).toFixed(1)} мм` },
      { label: 'Длина окр.', value: `${(2 * Math.PI * c.radius).toFixed(1)} мм` },
    ];
  }
  if (selectedObj.type === 'arc') {
    const a = selectedObj as ArcObject;
    const chord = Math.hypot(a.endX - a.startX, a.endY - a.startY);
    return [
      { label: 'Хорда', value: `${chord.toFixed(1)} мм` },
      { label: 'Направление', value: a.clockwise ? 'По часовой' : 'Против часовой' },
    ];
  }
  const pt = selectedObj as PointHoleObject;
  return [
    { label: 'Диаметр', value: `Ø${pt.diameter} мм` },
    { label: 'Глубина', value: `${pt.depth} мм` },
  ];
}

export const PropertiesPanel: React.FC = () => {
  const {
    selectedObjectIds,
    objects,
    updateObject,
    updateSelectedObjects,
    deleteObject,
    deleteSelectedObjects,
    duplicateObject,
    mirrorSelectedObjects,
    rotateSelectedObjects,
    alignSelectedObjects,
    setSelectedObjectId,
    toggleObjectSelection,
    focusCanvasOnObject,
    activeTool,
    liveEdit,
    liveMeasure,
    setShapeDialog,
    machine,
    updateMachine,
    joinSelectedObjects,
    alignSelectedObjectsToStock,
    setActiveTab,
  } = useProjectStore(
    useShallow((s) => ({
      selectedObjectIds: s.selectedObjectIds,
      objects: s.objects,
      updateObject: s.updateObject,
      updateSelectedObjects: s.updateSelectedObjects,
      deleteObject: s.deleteObject,
      deleteSelectedObjects: s.deleteSelectedObjects,
      duplicateObject: s.duplicateObject,
      mirrorSelectedObjects: s.mirrorSelectedObjects,
      rotateSelectedObjects: s.rotateSelectedObjects,
      alignSelectedObjects: s.alignSelectedObjects,
      setSelectedObjectId: s.setSelectedObjectId,
      toggleObjectSelection: s.toggleObjectSelection,
      focusCanvasOnObject: s.focusCanvasOnObject,
      activeTool: s.activeTool,
      liveEdit: s.liveEdit,
      liveMeasure: s.liveMeasure,
      setShapeDialog: s.setShapeDialog,
      machine: s.machine,
      updateMachine: s.updateMachine,
      joinSelectedObjects: s.joinSelectedObjects,
      alignSelectedObjectsToStock: s.alignSelectedObjectsToStock,
      setActiveTab: s.setActiveTab,
    }))
  );

  const selectedObjectId = useSelectedObjectId();
  const [stockMarginStr, setStockMarginStr] = React.useState('20');
  const [joinNotice, setJoinNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setJoinNotice(null);
  }, [selectedObjectIds]);

  const enableStockSheet = () => {
    const cur = machine.stockSheet;
    updateMachine({
      stockSheet: {
        enabled: true,
        preset: cur?.preset && cur.preset !== 'none' ? cur.preset : 'custom',
        widthX: cur?.widthX && cur.widthX > 0 ? cur.widthX : 1081,
        widthY: cur?.widthY && cur.widthY > 0 ? cur.widthY : 1681,
        color: cur?.color || '#22c55e',
      },
    });
  };

  const stockSheetEnabled = Boolean(
    machine.stockSheet?.enabled && machine.stockSheet.preset !== 'none'
  );
  const stockSummary =
    stockSheetEnabled && machine.stockSheet
      ? `${machine.stockSheet.widthY}×${machine.stockSheet.widthX}`
      : 'выкл';

  // ── Режим штангенциркуля (замера) ──
  if (activeTool === 'measure') {
    return <MeasurePropertiesView liveMeasure={liveMeasure} />;
  }

  const selectedObjs = objects.filter((o) => selectedObjectIds.includes(o.id));
  const joinableCount = selectedObjs.filter(
    (o) => !o.frozen && (o.type === 'line' || (o.type === 'polyline' && !o.closed && o.points.length >= 2))
  ).length;
  const hasJoinableSelected = joinableCount >= 2;

  // ── Групповое выделение ──
  if (selectedObjectIds.length > 1) {
    const allVisible = selectedObjs.every((o) => o.visible !== false);
    const allFrozen = selectedObjs.every((o) => o.frozen === true);

    return (
      <div className="text-xs text-fg overflow-y-auto h-full select-none flex flex-col">
        {/* Липкая шапка группы */}
        <div className="sticky top-0 z-10 px-3.5 py-2.5 bg-surface/95 backdrop-blur-sm border-b border-line space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
            <button
              type="button"
              onClick={() => setActiveTab('machine')}
              className="flex items-center gap-1 hover:text-fg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span>Лист и станок</span>
            </button>
            <span className="font-mono">Выбрано: {selectedObjectIds.length}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-accent shrink-0" />
              <span className="font-semibold text-sm text-fg truncate">Группа фигур</span>
            </div>

            <div className="flex items-center gap-0.5 bg-surface-subtle p-0.5 rounded-lg border border-line shrink-0">
              <button
                type="button"
                onClick={() => updateSelectedObjects({ visible: !allVisible })}
                title={allVisible ? 'Скрыть выбранные' : 'Показать выбранные'}
                className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {allVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => updateSelectedObjects({ frozen: !allFrozen })}
                title={allFrozen ? 'Разблокировать группу' : 'Зафиксировать группу'}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  allFrozen
                    ? 'text-accent bg-accent/12 hover:bg-accent/20'
                    : 'text-muted hover:text-fg hover:bg-surface-hover'
                }`}
              >
                {allFrozen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
              <div className="w-px h-3.5 bg-line mx-0.5" />
              <button
                type="button"
                onClick={deleteSelectedObjects}
                title="Удалить выбранные объекты (Del)"
                className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <InspectorSection
            title="Выравнивание и действия"
            collapsible
            defaultOpen
            storageKey="eznc_sec_group_transforms"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted font-medium">Выравнивание</span>
              <div className="flex items-center gap-0.5 bg-surface-subtle p-0.5 rounded-lg border border-line">
                <button
                  type="button"
                  disabled={allFrozen}
                  onClick={() => alignSelectedObjects('screenLeft')}
                  title="По левому краю"
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover disabled:opacity-35 cursor-pointer"
                >
                  <AlignHorizontalJustifyStart className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={allFrozen}
                  onClick={() => alignSelectedObjects('screenCenterH')}
                  title="По центру по горизонтали"
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover disabled:opacity-35 cursor-pointer"
                >
                  <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={allFrozen}
                  onClick={() => alignSelectedObjects('screenRight')}
                  title="По правому краю"
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover disabled:opacity-35 cursor-pointer"
                >
                  <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3.5 bg-line mx-0.5" />
                <button
                  type="button"
                  disabled={allFrozen}
                  onClick={() => alignSelectedObjects('screenTop')}
                  title="По верхнему краю"
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover disabled:opacity-35 cursor-pointer"
                >
                  <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={allFrozen}
                  onClick={() => alignSelectedObjects('screenCenterV')}
                  title="По центру по вертикали"
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover disabled:opacity-35 cursor-pointer"
                >
                  <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={allFrozen}
                  onClick={() => alignSelectedObjects('screenBottom')}
                  title="По нижнему краю"
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover disabled:opacity-35 cursor-pointer"
                >
                  <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <TransformActionsGrid
              disabled={allFrozen}
              isGroup
              showJoin
              joinDisabled={!hasJoinableSelected}
              onOpenDialog={setShapeDialog}
              onMirror={mirrorSelectedObjects}
              onRotate90={() => rotateSelectedObjects(90)}
              onJoin={() => {
                const count = joinSelectedObjects();
                setJoinNotice(
                  count > 0 ? null : 'Не найдено соприкасающихся концов (допуск 0.5 мм)'
                );
              }}
            />

            {joinNotice && (
              <div className="text-[11px] text-warning bg-warning/10 border border-warning/25 rounded-md px-2 py-1">
                {joinNotice}
              </div>
            )}
          </InspectorSection>

          <InspectorSection
            title="По листу ДСП"
            summary={stockSummary}
            collapsible
            defaultOpen={stockSheetEnabled}
            storageKey="eznc_sec_stock_align"
          >
            <StockAlignBlock
              stockSheet={machine.stockSheet}
              disabled={allFrozen}
              marginStr={stockMarginStr}
              onMarginChange={setStockMarginStr}
              onEnableStockSheet={enableStockSheet}
              onAlign={alignSelectedObjectsToStock}
            />
          </InspectorSection>

          <InspectorSection
            title="Состав выделения"
            summary={`${selectedObjs.length}`}
            collapsible
            defaultOpen
            storageKey="eznc_sec_group_members"
          >
            <div className="divide-y divide-line border border-line rounded-lg max-h-60 overflow-y-auto bg-surface-subtle/40">
              {selectedObjs.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-1.5 py-1.5 px-2.5 text-xs hover:bg-surface-hover transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedObjectId(o.id);
                      focusCanvasOnObject(o.id);
                    }}
                    title="Выбрать только эту фигуру и приблизить"
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <Crosshair className="w-3 h-3 text-muted shrink-0" />
                    <span className="font-medium text-fg-secondary hover:text-fg truncate">
                      {o.name}
                    </span>
                  </button>
                  <span className="font-mono text-[10px] text-muted shrink-0">
                    {typeLabel(o)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleObjectSelection(o.id)}
                    title="Убрать из выделения"
                    className="p-0.5 rounded text-muted hover:text-fg cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </InspectorSection>
        </div>
      </div>
    );
  }

  const committedObj = objects.find((o) => o.id === selectedObjectId);

  // ── Ничего не выбрано → автоматически показываем «Лист и станок» вместо пустой заглушки ──
  if (!committedObj) {
    return <MachineSettingsPanel />;
  }

  const selectedObj =
    liveEdit && liveEdit.id === committedObj.id
      ? ({ ...committedObj, ...liveEdit.patch } as typeof committedObj)
      : committedObj;

  const isFrozen = selectedObj.frozen === true;
  const isVisible = selectedObj.visible !== false;
  const telemetryPairs = getTelemetryPairs(selectedObj);

  return (
    <div className="text-xs text-fg overflow-y-auto h-full select-none flex flex-col">
      {/* 1. Липкая шапка фигуры с инлайн-переименованием и компактной телеметрией */}
      <div className="sticky top-0 z-10 px-3.5 py-2.5 bg-surface/95 backdrop-blur-sm border-b border-line space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <button
            type="button"
            onClick={() => setActiveTab('machine')}
            className="flex items-center gap-1 hover:text-fg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3 shrink-0" />
            <span>Лист и станок</span>
          </button>
          <span className="truncate">{typeLabel(selectedObj)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {renderTypeIcon(selectedObj.type)}
          <input
            type="text"
            value={selectedObj.name}
            aria-label="Наименование фигуры в управляющей программе"
            placeholder="Название фигуры"
            onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            className="flex-1 min-w-0 bg-transparent hover:bg-surface-subtle focus:bg-surface border border-transparent hover:border-line focus:border-accent rounded-md px-1.5 py-1 text-sm font-semibold text-fg focus:outline-none transition-colors"
          />

          <div className="flex items-center gap-0.5 bg-surface-subtle p-0.5 rounded-lg border border-line shrink-0">
            <button
              type="button"
              onClick={() => updateObject(selectedObj.id, { visible: !isVisible })}
              title={isVisible ? 'Скрыть фигуру из программы' : 'Показать фигуру'}
              className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => updateObject(selectedObj.id, { frozen: !isFrozen })}
              title={
                isFrozen
                  ? 'Разблокировать (разрешить перемещение)'
                  : 'Зафиксировать (защита от случайного сдвига)'
              }
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                isFrozen
                  ? 'text-accent bg-accent/12 hover:bg-accent/20'
                  : 'text-muted hover:text-fg hover:bg-surface-hover'
              }`}
            >
              {isFrozen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => duplicateObject(selectedObj.id)}
              title="Дублировать со смещением +10 мм"
              className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-line mx-0.5" />
            <button
              type="button"
              onClick={() => deleteObject(selectedObj.id)}
              title="Удалить объект (Del)"
              className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Компактная табличная сводка без рамок */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted">
          {telemetryPairs.map((pair, idx) => (
            <React.Fragment key={pair.label}>
              {idx > 0 && <span aria-hidden="true">·</span>}
              <span>
                {pair.label}{' '}
                <strong className="font-mono font-semibold text-fg-secondary">{pair.value}</strong>
              </span>
            </React.Fragment>
          ))}
          {isFrozen && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-accent font-medium">
                <Lock className="w-2.5 h-2.5 shrink-0" />
                Зафиксирована
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Секции параметров */}
      <div className="flex-1">
        <InspectorSection title="Геометрия (мм)">
          {selectedObj.type === 'point' && (
            <PointProperties
              obj={selectedObj as PointHoleObject}
              onUpdate={(partial) => updateObject(selectedObj.id, partial)}
            />
          )}

          {selectedObj.type === 'line' && (
            <LineProperties
              obj={selectedObj as LineObject}
              onUpdate={(partial) => updateObject(selectedObj.id, partial)}
            />
          )}

          {selectedObj.type === 'polyline' && (
            <PolylineProperties
              obj={selectedObj as PolylineObject}
              onUpdate={(partial) => updateObject(selectedObj.id, partial)}
            />
          )}

          {selectedObj.type === 'rectangle' && (
            <RectangleProperties
              obj={selectedObj as RectangleObject}
              onUpdate={(partial) => updateObject(selectedObj.id, partial)}
            />
          )}

          {selectedObj.type === 'circle' && (
            <CircleProperties
              obj={selectedObj as CircleObject}
              onUpdate={(partial) => updateObject(selectedObj.id, partial)}
            />
          )}

          {selectedObj.type === 'arc' && (
            <ArcProperties
              obj={selectedObj as ArcObject}
              onUpdate={(partial) => updateObject(selectedObj.id, partial)}
            />
          )}
        </InspectorSection>

        <InspectorSection
          title="Преобразования"
          collapsible
          defaultOpen
          storageKey="eznc_sec_transforms"
        >
          <TransformActionsGrid
            disabled={isFrozen}
            isGroup={false}
            showScale={selectedObj.type !== 'point'}
            parallelKind={
              selectedObj.type === 'line' || selectedObj.type === 'arc' ? selectedObj.type : null
            }
            onOpenDialog={setShapeDialog}
            onMirror={mirrorSelectedObjects}
            onRotate90={() => rotateSelectedObjects(90)}
          />
        </InspectorSection>

        <InspectorSection
          title="По листу ДСП"
          summary={stockSummary}
          collapsible
          defaultOpen={stockSheetEnabled}
          storageKey="eznc_sec_stock_align"
        >
          <StockAlignBlock
            stockSheet={machine.stockSheet}
            disabled={isFrozen}
            marginStr={stockMarginStr}
            onMarginChange={setStockMarginStr}
            onEnableStockSheet={enableStockSheet}
            onAlign={alignSelectedObjectsToStock}
          />
        </InspectorSection>
      </div>
    </div>
  );
};

import { CADObject, MachineSettings, UnderlayState } from '../types';

export const LOCAL_STORAGE_KEY = 'cnc_studio_project_v1';

// Дефолт = пресет «Изголовье Ø3» (PROJECT_MODE_PRESETS.head).
export const INITIAL_MACHINE: MachineSettings = {
  units: 'mm',
  controllerProfile: 'ncstudio',
  bounds: {
    xMin: -1600,
    xMax: 0,
    yMin: -2000,
    yMax: 0,
    zMin: -50,
    zMax: 100,
  },
  // Заготовка листа по умолчанию выключена (как при выключении тумблером в панели:
  // preset 'none'). Размеры сохранены — включение возвращает лист 1081×1681.
  stockSheet: {
    enabled: false,
    preset: 'none',
    widthX: 1081,
    widthY: 1681,
    color: '#22c55e',
  },
  workOffset: {
    x: 0,
    y: 0,
  },
  safeZ: 10,
  cutDepth: 17.5,
  spindleSpeed: 18000,
  spindleDwell: 3000,
  feedCut: 2000,
  feedPlunge: 700,
  feedDrill: 700,
  toolDiameter: 3,
  toolName: 'Фреза 3мм',
  useCannedCycles: true,
};

// Режим проекта выбирается при создании (модалка «Новый проект»).
// Тип листа = выбор фрезы: изголовье — узор фрезой Ø3, царга — рез/сверловка фрезой Ø8.
export type ProjectMode = 'head' | 'rail';

/** Признак режима «Царга» (крупная фреза Ø5+ мм): единая проверка для UI. */
export function isRailMachine(machine: Pick<MachineSettings, 'toolDiameter'>): boolean {
  return (machine.toolDiameter ?? 0) >= 5;
}

export const PROJECT_MODE_PRESETS: Record<ProjectMode, MachineSettings> = {
  head: INITIAL_MACHINE,
  rail: {
    ...INITIAL_MACHINE,
    cutDepth: 33.5,
    spindleSpeed: 15000,
    feedCut: 700,
    feedPlunge: 700,
    feedDrill: 700,
    toolDiameter: 8,
    toolName: 'Фреза 8мм',
    stockSheet: {
      enabled: true,
      preset: 'custom',
      widthY: 2080,
      widthX: 360,
      color: '#22c55e',
    },
  },
};

export const INITIAL_OBJECTS: CADObject[] = [
  {
    id: 'obj_hole_1',
    name: 'Отверстие 1 (X-100 Y-100)',
    type: 'point',
    x: -100,
    y: -100,
    diameter: 11.0,
    depth: 33,
    drillMode: '11mm',
    operationType: 'drill',
  },
  {
    id: 'obj_hole_2',
    name: 'Отверстие 2 (X-200 Y-100)',
    type: 'point',
    x: -200,
    y: -100,
    diameter: 9.0,
    depth: 33,
    drillMode: '9mm',
    operationType: 'drill',
  },
  {
    id: 'obj_line_1',
    name: 'Линия X 200мм',
    type: 'line',
    startX: -50,
    startY: -50,
    endX: -250,
    endY: -50,
    depth: 5,
    operationType: 'cut',
  },
  {
    id: 'obj_line_2',
    name: 'Линия Y 150мм',
    type: 'line',
    startX: -250,
    startY: -50,
    endX: -250,
    endY: -200,
    depth: 5,
    operationType: 'cut',
  },
];

// Пустая подложка: фоновая референсная картинка существует только на время сессии.
export const DEFAULT_UNDERLAY: UnderlayState = {
  src: null,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  opacity: 0.5,
  visible: true,
  frozen: false,
};

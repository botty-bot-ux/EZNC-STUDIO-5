import { ShapeType } from '../../types';

/**
 * ЕДИНЫЙ контракт формата G-кода между генератором и парсером.
 *
 * Раньше маркеры объектов «писались» строкой в generator.ts и «разбирались»
 * регуляркой в parser.ts независимо друг от друга: правка в одном файле молча
 * ломала round-trip в другом. Здесь собраны обе стороны формата и общие
 * числовые допущения — менять можно только вместе, и это видно по импортам.
 */

// --- Маркеры ---

/** Тег встроенного JSON проекта в комментарии .nc-файла ("; NCSTUDIO_PROJECT:{...}"). */
export const PROJECT_JSON_TAG = 'NCSTUDIO_PROJECT';

/** Префикс имени объекта в заголовке («ОБЪЕКТ:» в компактном и legacy-форматах). */
export const OBJECT_LABEL = 'ОБЪЕКТ:';

/** Типы фигур, допустимые в маркере заголовка (для конструирования групп регулярки). */
export const MARKER_SHAPE_TYPES = 'point|line|polyline|rectangle|circle|arc';

/** Строка маркера объекта, которую генератор ставит перед каждой фигурой. */
export function formatObjectMarker(id: string, name: string, type: ShapeType): string {
  return `;[ID: ${id}] ${name} (${type})`;
}

/** Строка, начинающаяся с маркера объекта (используется при «чистом» экспорте). */
export const OBJECT_MARKER_LINE_RE = /^\s*;\s*\[ID:/i;

// --- Числовые допущения парсера ---

/** Начальный Z при разборе чужого G-кода, мм. */
export const DEFAULT_SAFE_Z_MM = 10;

/** Глубина по умолчанию, если в траектории нет отрицательных Z, мм. */
export const DEFAULT_DEPTH_MM = 5;

/** Диаметр точки (сверления) по умолчанию при импорте, мм. */
export const DEFAULT_POINT_DIAMETER_MM = 3;

/** Радиус-запасница для вырожденных окружностей/дуг при импорте, мм. */
export const DEFAULT_IMPORT_RADIUS_MM = 10;

/** «Точки совпадают» / нулевое смещение по XY, мм. */
export const EPS_POINT_MM = 0.001;

/** Замыкание окружности/прямоугольника (старт == конец), мм. */
export const EPS_CLOSE_MM = 0.01;

/** «На глаз» замкнутая полилиния при импорте, мм. */
export const EPS_CLOSED_POLYLINE_MM = 0.1;

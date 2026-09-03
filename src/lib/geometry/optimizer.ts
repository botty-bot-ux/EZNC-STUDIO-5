import { CADObject, Point2D } from '../../types';

// ===== КОНФИГУРАЦИЯ (вынесено из магических чисел) =====
interface OptimizationConfig {
  max2OptPasses?: number;     // Макс. проходов 2-opt
  opt2Window?: number;        // Размер окна для 2-opt
  improvementThreshold?: number; // Мин. улучшение для продолжения (мм)
  rapidSpeedMmPerSec?: number;  // Скорость быстрого перемещения
  returnToStart?: boolean;    // Возвращать ли в точку старта
}

const DEFAULT_CONFIG: Required<OptimizationConfig> = {
  max2OptPasses: 5,
  opt2Window: 30,
  improvementThreshold: 0.01,
  rapidSpeedMmPerSec: 50,
  returnToStart: true,
};

export interface OptimizationResult {
  optimizedObjects: CADObject[];
  initialDistance: number;
  optimizedDistance: number;
  savedDistance: number;
  savedPercentage: number;
  reorderedCount: number;
  flippedCount: number;
  estimatedTimeSavedSec: number;
  elapsedMs: number;           // Добавил для отладки
  totalObjects: number;
}

// ===== БАЗОВАЯ МАТЕМАТИКА =====
export function euclideanDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // Оптимизация: сначала считаем квадрат — sqrt не нужен для сравнений
  return Math.sqrt(dx * dx + dy * dy);
}

// Квадрат расстояния — для сравнений без извлечения корня (экономия CPU)
function euclideanDistanceSq(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

// ===== КОНЕЧНЫЕ ТОЧКИ =====
export function getObjectEndpoints(obj: CADObject): {
  start: Point2D;
  end: Point2D;
  flippable: boolean;
} {
  switch (obj.type) {
    case 'point': {
      const pt = { x: obj.x, y: obj.y };
      return { start: pt, end: pt, flippable: false };
    }
    case 'line':
      return {
        start: { x: obj.startX, y: obj.startY },
        end: { x: obj.endX, y: obj.endY },
        flippable: true,
      };
    case 'polyline': {
      if (!obj.points || obj.points.length === 0) {
        const zero = { x: 0, y: 0 };
        return { start: zero, end: zero, flippable: false };
      }
      const first = obj.points[0];
      const last = obj.closed ? first : obj.points[obj.points.length - 1];
      return { start: first, end: last, flippable: !obj.closed };
    }
    case 'rectangle': {
      const pt = { x: obj.x, y: obj.y };
      return { start: pt, end: pt, flippable: false };
    }
    case 'circle': {
      const pt = { x: obj.centerX - obj.radius, y: obj.centerY };
      return { start: pt, end: pt, flippable: false };
    }
    case 'arc':
      return {
        start: { x: obj.startX, y: obj.startY },
        end: { x: obj.endX, y: obj.endY },
        flippable: true,
      };
  }
}

// ===== ПЕРЕВОРОТ ОБЪЕКТА =====
export function flipObject(obj: CADObject): CADObject {
  switch (obj.type) {
    case 'line':
      return {
        ...obj,
        startX: obj.endX, startY: obj.endY,
        endX: obj.startX, endY: obj.startY,
      };
    case 'polyline':
      if (obj.closed || !obj.points) return obj;
      return { ...obj, points: [...obj.points].reverse() };
    case 'arc':
      return {
        ...obj,
        startX: obj.endX, startY: obj.endY,
        endX: obj.startX, endY: obj.startY,
        clockwise: !obj.clockwise,
      };
    default:
      return obj;
  }
}

// ===== ГЛАВНАЯ ФУНКЦИЯ =====
export function optimizeCADObjects(
  objects: CADObject[],
  startPos: Point2D = { x: 0, y: 0 },
  config: OptimizationConfig = {},
  onProgress?: (progress: number) => void
): OptimizationResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Фильтруем видимые объекты И сохраняем исходный порядок
  const visibleObjects = objects.filter((o) => o.visible !== false);

  if (visibleObjects.length === 0) {
    return emptyResult(performance.now() - startTime, objects.length);
  }

  // ✅ Клонирование через structuredClone (в разы быстрее JSON)
  // Если structuredClone недоступен — используем fallback
  const cloneObjects = (objs: CADObject[]): CADObject[] =>
    (typeof structuredClone === 'function'
      ? structuredClone(objs)
      : JSON.parse(JSON.stringify(objs))) as CADObject[];

  const initialDistance = calculateTotalRapidDistance(visibleObjects, startPos, cfg.returnToStart);

  // Сохраняем "эталонные" данные для статистики ДО оптимизации
  const originalIds = visibleObjects.map((o) => o.id);

  // ===== ШАГ 1: Жадный ближайший сосед =====
  // Используем Set вместо splice — O(1) удаление против O(n)
  const pool = new Set(cloneObjects(visibleObjects));
  const resultList: CADObject[] = [];
  let currentPos = { ...startPos };
  let greedyFlipped = 0;

  let lastProgressUpdate = 0;
  const totalObjects = pool.size;

  while (pool.size > 0) {
    let bestObj: CADObject | null = null;
    let bestDistSq = Infinity;
    let shouldFlip = false;

    for (const candidate of pool) {
      const { start, end, flippable } = getObjectEndpoints(candidate);

      const distNormalSq = euclideanDistanceSq(currentPos, start);
      if (distNormalSq < bestDistSq) {
        bestDistSq = distNormalSq;
        bestObj = candidate;
        shouldFlip = false;
      }

      if (flippable) {
        const distFlippedSq = euclideanDistanceSq(currentPos, end);
        if (distFlippedSq < bestDistSq) {
          bestDistSq = distFlippedSq;
          bestObj = candidate;
          shouldFlip = true;
        }
      }
    }

    if (bestObj) {
      pool.delete(bestObj);
      if (shouldFlip) {
        bestObj = flipObject(bestObj);
        greedyFlipped++;
      }
      resultList.push(bestObj);
      currentPos = { ...getObjectEndpoints(bestObj).end };
    }

    // Репортим прогресс (но не чаще чем раз в 100мс, чтобы не грузить UI)
    if (onProgress && performance.now() - lastProgressUpdate > 100) {
      onProgress(1 - pool.size / totalObjects);
      lastProgressUpdate = performance.now();
    }
  }

  // ===== ШАГ 2: 2-Opt refinement =====
  let optFlipped = 0;
  let improved = true;
  let passes = 0;

  while (improved && passes < cfg.max2OptPasses) {
    improved = false;
    passes++;

    for (let i = 0; i < resultList.length - 1; i++) {
      const jMax = Math.min(resultList.length - 1, i + cfg.opt2Window);

      for (let j = i + 1; j <= jMax; j++) {
        const prevEnd = i === 0 ? startPos : getObjectEndpoints(resultList[i - 1]).end;
        const currentDist = calculateSubsegmentDist(resultList, i, j, prevEnd);

        // Пробуем реверс + переворот каждого объекта
        const reversedSub = resultList
          .slice(i, j + 1)
          .reverse()
          .map((o) => {
            const flipped = flipObject(o);
            if (flipped !== o) optFlipped++;
            return flipped;
          });

        const testList = [
          ...resultList.slice(0, i),
          ...reversedSub,
          ...resultList.slice(j + 1),
        ];

        const newDist = calculateSubsegmentDist(testList, i, j, prevEnd);

        if (newDist < currentDist - cfg.improvementThreshold) {
          for (let k = 0; k < reversedSub.length; k++) {
            resultList[i + k] = reversedSub[k];
          }
          improved = true;
        }
      }
    }
  }

  // ===== ШАГ 3: Корректная статистика =====
  const optimizedDistance = calculateTotalRapidDistance(resultList, startPos, cfg.returnToStart);
  const savedDistance = Math.max(0, initialDistance - optimizedDistance);
  const savedPercentage = initialDistance > 0 ? (savedDistance / initialDistance) * 100 : 0;

  // Правильный подсчет reordered: через LCS (длиннейшая общая подпоследовательность)
  const newIds = resultList.map((o) => o.id);
  const reorderedCount = totalObjects - longestCommonSubsequenceLength(originalIds, newIds);

  // flippedCount — учитываем перевороты и в greedy, и в 2-opt
  const flippedCount = greedyFlipped + optFlipped;

  const elapsedMs = performance.now() - startTime;
  const estimatedTimeSavedSec = savedDistance / cfg.rapidSpeedMmPerSec;

  onProgress?.(1);

  return {
    optimizedObjects: resultList,
    initialDistance,
    optimizedDistance,
    savedDistance,
    savedPercentage,
    reorderedCount,
    flippedCount,
    estimatedTimeSavedSec,
    elapsedMs,
    totalObjects,
  };
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function calculateTotalRapidDistance(
  objects: CADObject[],
  startPos: Point2D,
  returnToStart: boolean
): number {
  let currentPos = { ...startPos };
  let total = 0;

  for (const obj of objects) {
    const { start, end } = getObjectEndpoints(obj);
    total += euclideanDistance(currentPos, start);
    currentPos = { ...end };
  }

  if (returnToStart) total += euclideanDistance(currentPos, startPos);
  return total;
}

function calculateSubsegmentDist(
  list: CADObject[],
  fromIdx: number,
  toIdx: number,
  prevEndPos: Point2D
): number {
  let dist = 0;
  let pos = { ...prevEndPos };

  for (let k = fromIdx; k <= toIdx; k++) {
    const { start, end } = getObjectEndpoints(list[k]);
    dist += euclideanDistance(pos, start);
    pos = { ...end };
  }

  if (toIdx + 1 < list.length) {
    const nextStart = getObjectEndpoints(list[toIdx + 1]).start;
    dist += euclideanDistance(pos, nextStart);
  }

  return dist;
}

// Длина LCS для корректного подсчета перестановок (O(n*m))
function longestCommonSubsequenceLength<T>(a: T[], b: T[]): number {
  const n = a.length;
  const m = b.length;
  // Используем две строки вместо матрицы — экономим память
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[m];
}

function emptyResult(elapsedMs: number, totalObjects: number): OptimizationResult {
  return {
    optimizedObjects: [],
    initialDistance: 0,
    optimizedDistance: 0,
    savedDistance: 0,
    savedPercentage: 0,
    reorderedCount: 0,
    flippedCount: 0,
    estimatedTimeSavedSec: 0,
    elapsedMs,
    totalObjects,
  };
}
// Фасад модульных CAD-операций: обрезка («Ножницы»), скругление (Fillet),
// объединение контуров (Join) и выравнивание относительно листа ДСП.

export { getArcSweepSpan, computeTrimOperation } from './trimOps';
export type { TrimOperationResult } from './trimOps';

export { computeTwoLineFillet } from './filletOps';
export type { TwoLineFilletResult, TwoLineFilletOutcome } from './filletOps';

export {
  joinSelectedContours,
  computeStockAlignmentDelta,
  translateObjectsList,
} from './contourOps';
export type { JoinContoursResult } from './contourOps';

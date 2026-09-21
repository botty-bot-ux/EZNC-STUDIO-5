import React, { useCallback, useRef } from 'react';

/**
 * Общий обработчик «зажать и тянуть» для стрелок ▲/▼.
 *
 * Повешенные на кнопку возвращённые пропсы дают три режима:
 *  1) обычный клик — один шаг в направлении `clickDir` (▲ = +1, ▼ = −1);
 *  2) зажать и вести мышь вверх/вниз — каждый `pxPerStep` пикселей = один шаг;
 *     направление считается от точки нажатия, так что тянуть можно и вниз с ▲-кнопки,
 *     и вверх с ▼-кнопки, — значение просто идёт в выбранную сторону;
 *  3) клик с удержанием без движения = тот же один шаг (порог «это drag» = 3 px).
 *
 * На каждый pointermove приходит ОДНО значение net-delta (целое число шагов с прошлой
 * точки), поэтому обработчик-получатель может спокойно читать актуальные React-стейты
 * и делать один шаг setState за событие — без «гонки» на быстрых драгах.
 *
 * Дополнительно: `preventDefault` на pointerdown не даёт кнопке увести фокус с input,
 * поэтому живой черновик (draft) внутри поля не сбрасывается при скрабе.
 */
export interface ScrubHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  style: React.CSSProperties;
}

export function useScrub(
  onScrub: (deltaSteps: number) => void,
  options: { clickDir: 1 | -1; pxPerStep?: number },
): ScrubHandlers {
  const { clickDir, pxPerStep = 6 } = options;

  // Держим самый свежий колбэк, чтобы обработчики не пересоздавались на каждый рендер.
  const cbRef = useRef(onScrub);
  cbRef.current = onScrub;

  const stateRef = useRef<{
    startY: number;
    lastSteps: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    // ЛКМ либо касание/перо; правую кнопку игнорируем.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.currentTarget as HTMLElement & {
      setPointerCapture?: (id: number) => void;
    };
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      /* если браузер не поддерживает — живём без capture */
    }
    stateRef.current = { startY: e.clientY, lastSteps: 0, moved: false, pointerId: e.pointerId };
    // Не даём кнопке забрать фокус у input (важно для черновика в PropertyInput).
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const st = stateRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      const dy = st.startY - e.clientY; // вверх = положительно
      if (!st.moved && Math.abs(dy) < 3) return; // маленький мёртвый зона «это клик»
      if (!st.moved) st.moved = true;
      const totalSteps = Math.trunc(dy / pxPerStep);
      const delta = totalSteps - st.lastSteps;
      if (delta === 0) return;
      st.lastSteps = totalSteps;
      cbRef.current(delta);
    },
    [pxPerStep],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>, fireClick: boolean) => {
      const st = stateRef.current;
      if (!st || st.pointerId !== e.pointerId) return;
      stateRef.current = null;
      const target = e.currentTarget as HTMLElement & {
        releasePointerCapture?: (id: number) => void;
      };
      try {
        target.releasePointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      if (fireClick && !st.moved) cbRef.current(clickDir);
    },
    [clickDir],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => endDrag(e, true),
    [endDrag],
  );
  const onPointerCancel = useCallback(() => {
    stateRef.current = null;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    style: { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties,
  };
}

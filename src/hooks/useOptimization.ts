import { useState } from 'react';
import { OptimizationResult } from '../lib/geometry/optimizer';
import { useProjectStore } from '../store/useProjectStore';

/**
 * State controller for the "Экспорт на ЧПУ" window: opening/closing it, running the
 * route optimization (with an in-place undo), and tracking the last optimization result.
 * The actual file saving lives in the Header (it needs the native Save dialog).
 */
export function useOptimization() {
  const optimizeRoute = useProjectStore((s) => s.optimizeRoute);
  const undo = useProjectStore((s) => s.undo);

  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const openExportModal = () => setIsExportModalOpen(true);
  const closeExportModal = () => {
    setIsExportModalOpen(false);
    // Forget the previous run so re-opening starts fresh and "Оптимизировать" is available again.
    setOptResult(null);
  };

  const runOptimize = () => {
    const res = optimizeRoute();
    if (res) {
      setOptResult(res);
    } else {
      alert('Нет объектов для оптимизации.');
    }
  };

  const undoOptimize = () => {
    if (!optResult) return;
    undo();
    setOptResult(null);
  };

  return {
    optResult,
    isExportModalOpen,
    openExportModal,
    closeExportModal,
    runOptimize,
    undoOptimize,
  };
}

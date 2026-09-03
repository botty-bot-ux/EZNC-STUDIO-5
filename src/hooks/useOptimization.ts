import { useState } from 'react';
import { OptimizationResult } from '../lib/geometry/optimizer';
import { useProjectStore } from '../store/useProjectStore';

export function useOptimization() {
  const optimizeRoute = useProjectStore((s) => s.optimizeRoute);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [isOptModalOpen, setIsOptModalOpen] = useState(false);

  const handleOptimizeClick = () => {
    const res = optimizeRoute();
    if (res) {
      setOptResult(res);
      setIsOptModalOpen(true);
    } else {
      alert('Нет объектов для оптимизации.');
    }
  };

  const closeOptModal = () => setIsOptModalOpen(false);

  return {
    optResult,
    isOptModalOpen,
    handleOptimizeClick,
    closeOptModal,
  };
}

import { MachineSettings } from '../../types';
import { PROJECT_MODE_PRESETS, ProjectMode } from '../initialState';
import { ProjectStore, StoreCtx } from '../projectStore.types';

/**
 * Срез настроек станка: редактирование параметров и переключение пресета
 * «Изголовье Ø3» / «Царга Ø8» с синхронизацией активного инструмента.
 */
export function createMachineSlice(
  ctx: StoreCtx
): Pick<ProjectStore, 'updateMachine' | 'applyMachinePreset'> {
  const { get, pushHistory, pushHistoryCoalesced, syncAndSave } = ctx;

  return {
    updateMachine: (partial: Partial<MachineSettings>) => {
      pushHistoryCoalesced(`machine:${Object.keys(partial).sort().join('+')}`);
      syncAndSave({
        machine: { ...get().machine, ...partial },
      });
    },

    applyMachinePreset: (mode: ProjectMode) => {
      pushHistory();
      const preset = structuredClone(PROJECT_MODE_PRESETS[mode]);
      const curTool = get().activeTool;
      const nextTool =
        mode === 'rail' && curTool === 'arc'
          ? 'point'
          : mode === 'head' && curTool === 'point'
          ? 'arc'
          : curTool;
      syncAndSave({
        machine: { ...get().machine, ...preset },
        activeTool: nextTool,
      });
    },
  };
}

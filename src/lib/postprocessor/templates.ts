import { PostprocessorTemplates } from '../../types';

export const DEFAULT_TEMPLATES: PostprocessorTemplates = {
  header: `;==========================================
; ЧПУ Управляющая программа NC-Studio (*.NC / *.CNC)
; Постпроцессор: NcStudio v5 / Vectric Aspire
;==========================================
%
T1M6
G0 Z{safeZ}
G0 X0.000 Y0.000 S{spindleSpeed} M3`,

  footer: `;==========================================
; Завершение программы NC-Studio
;==========================================
G0 Z{safeZ}
G0 X0.000 Y0.000
M30`,

  toolChange: `; Смена инструмента: {toolName}
M5
G0 Z{safeZ}
T1M6`,

  spindleStart: `S{spindleSpeed} M3\nG4 P{spindleDwell}`,
  spindleStop: `M5`,
};


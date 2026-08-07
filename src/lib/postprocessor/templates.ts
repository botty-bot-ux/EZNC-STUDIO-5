import { PostprocessorTemplates } from '../../types';

export const DEFAULT_TEMPLATES: PostprocessorTemplates = {
  header: `G21 G17 G90 G40 G49 G80
S{spindleSpeed} M03
G04 P3.0
G00 X0.000 Y0.000`,

  footer: `G00 Z{safeZ}
M05
G00 X0.000 Y0.000
M30`,

  toolChange: `M05
G00 Z{safeZ}
T1M6`,

  spindleStart: `S{spindleSpeed} M03\nG04 P3.0`,
  spindleStop: `M05`,
};




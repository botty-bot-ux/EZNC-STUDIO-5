import {
  CADObject,
  MachineSettings,
  PostprocessorTemplates,
  ProjectData,
  ToolpathSegment,
  WarningItem,
} from '../types';
import { generateGcode } from '../lib/gcode/generator';
import { analyzeProjectWarnings } from '../lib/utils/warnings';
import { DEFAULT_TEMPLATES } from '../lib/postprocessor/templates';
import { INITIAL_MACHINE, INITIAL_OBJECTS, LOCAL_STORAGE_KEY } from './initialState';
import { Theme, applyThemeClass, readStoredTheme } from './theme';

export interface InitialProjectState {
  projectName: string;
  machine: MachineSettings;
  objects: CADObject[];
  templates: PostprocessorTemplates;
  generatedGcode: string;
  toolpathSegments: ToolpathSegment[];
  warnings: WarningItem[];
  theme: Theme;
}

// Загрузка начального состояния из localStorage + первичная генерация G-кода/
// предупреждений/темы. Вынесено из тела create(), чтобы сам стор остался про действия.
export function loadInitialProjectState(): InitialProjectState {
  let initName = 'Проект_ЧПУ_Деталь_1';
  let initMachine = INITIAL_MACHINE;
  let initObjects = INITIAL_OBJECTS;
  let initTemplates = DEFAULT_TEMPLATES;

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ProjectData;
      if (parsed && parsed.objects && parsed.machine) {
        initName = parsed.name || initName;
        initMachine = {
          ...INITIAL_MACHINE,
          ...parsed.machine,
          bounds: { ...INITIAL_MACHINE.bounds, ...parsed.machine.bounds },
        };
        // One-time refresh: a cached project that still carries the OLD default tool/feeds
        // (i.e. never customized) is upgraded to the new «Изголовье» defaults. Edited projects
        // keep their own values.
        const pm = parsed.machine as Partial<MachineSettings> | undefined;
        if (pm && pm.toolDiameter === 3.175 && pm.cutDepth === 5 && pm.feedCut === 1200) {
          initMachine = { ...INITIAL_MACHINE };
        }
        initObjects = parsed.objects;
        initTemplates = parsed.postprocessorTemplates || DEFAULT_TEMPLATES;

        // Automatically upgrade old default templates to new standard NC Studio 5 template
        if (
          !initTemplates.header ||
          !initTemplates.header.includes('G21') ||
          initTemplates.header.includes('%') ||
          initTemplates.header.includes('NC-Studio')
        ) {
          initTemplates = DEFAULT_TEMPLATES;
        }
      }
    }
  } catch {
    // fallback
  }

  const initialGen = generateGcode(initObjects, [], initMachine, initTemplates);
  const initialWarns = analyzeProjectWarnings(initObjects, [], initMachine);

  const initialTheme = readStoredTheme();
  applyThemeClass(initialTheme);

  return {
    projectName: initName,
    machine: initMachine,
    objects: initObjects,
    templates: initTemplates,
    generatedGcode: initialGen.gcode,
    toolpathSegments: initialGen.segments,
    warnings: initialWarns,
    theme: initialTheme,
  };
}

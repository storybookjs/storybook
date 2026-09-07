import type { StoriesByFileRecord } from '../module-graph/types.ts';

export type ModuleGraphIndexServiceState = {
  workingDir: string;
  storiesByFile: StoriesByFileRecord;
};

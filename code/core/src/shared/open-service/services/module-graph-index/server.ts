import { registerService } from '../../server.ts';
import { moduleGraphIndexServiceDef } from './definition.ts';

/** Registers the cold reverse-index half of the module graph. Call before the hot service. */
export function registerModuleGraphIndexService(workingDir = process.cwd()) {
  return registerService({
    ...moduleGraphIndexServiceDef,
    initialState: {
      ...moduleGraphIndexServiceDef.initialState,
      workingDir,
    },
  });
}

import type { ModuleInfo } from '@fal-works/esbuild-plugin-global-externals';
import Exports from './exports';
import { globalPackages, globalsNameReferenceMap } from './globals';

/*
 * We create a map of a module's name to a ModuleInfo.
 * Which is a config object for a esbuild-plugin, to swap a import of a module to a reference of a global variable.
 * To get this plugin to do the best job it can, it needs to know all the exports in the ModuleInfo config object.
 * We generate this information via a script into `exports.ts`.
 *
 * It's really important that there are no actual to the runtime of the modules, hence the cumbersome generation.
 * But we also want to ensure we don't miss any exports, or globals.
 *
 * So in order to add additional modules to be swapped for globals, you need to add them to:
 * - `Keys` in `types.ts`
 * - `values` in `runtime.ts`.
 *
 * If you forget to do either, TypeScript will complain.
 *
 * This `globals-module-info.ts` file is consumed by the `builder-manager` package,
 * The `runtime.ts` file is used inside the manager's browser code runtime.
 */

export const globalsModuleInfoMap = globalPackages.reduce(
  (acc, key) => {
    acc[key] = {
      type: 'esm',
      varName: globalsNameReferenceMap[key],
      namedExports: Exports[key],
      defaultExport: true,
    };
    return acc;
  },
  {} as Required<Record<keyof typeof globalsNameReferenceMap, Required<ModuleInfo>>>
);

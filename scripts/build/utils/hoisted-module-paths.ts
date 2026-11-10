import { readFile, writeFile } from 'node:fs/promises';

import type * as esbuild from 'esbuild';
import { join } from 'pathe';
import type { Plugin as RolldownPlugin } from 'rolldown';

// The store segment in `node_modules/.pnpm/<name>@<version>_<peers>/node_modules/<name>/...`.
const PNPM_STORE_SEGMENT = /node_modules\/\.pnpm\/[^/]+\/node_modules\//g;
const PNPM_MODULE_PATH = /(?:\.\.\/)*node_modules\/\.pnpm\/[^/\s"]+\/node_modules\/[^\s"]+/g;

// The path the module would have in a hoisted `node_modules`, as Yarn and npm install it.
export const hoistModulePath = (path: string) => path.replace(PNPM_STORE_SEGMENT, 'node_modules/');

// Only the given modules' paths: dependencies bundled with pnpm upstream keep their own keys.
export function hoistEsbuildModulePaths(code: string, modulePaths: ReadonlySet<string>) {
  return code.replace(PNPM_MODULE_PATH, (path) =>
    modulePaths.has(path) ? hoistModulePath(path) : path
  );
}

export const esbuildHoistedModulePaths: esbuild.Plugin = {
  name: 'hoisted-module-paths',
  setup(build) {
    build.initialOptions.metafile = true;
    const cwd = build.initialOptions.absWorkingDir ?? process.cwd();
    // esbuild writes the output files before it runs `onEnd` callbacks.
    build.onEnd(async ({ metafile }) => {
      await Promise.all(
        Object.entries(metafile?.outputs ?? {}).map(async ([file, { inputs }]) => {
          const modulePaths = new Set(
            Object.keys(inputs).filter((path) => path.includes('node_modules/.pnpm/'))
          );
          if (modulePaths.size === 0) {
            return;
          }
          const outputFile = join(cwd, file);
          const code = await readFile(outputFile, 'utf8');
          const hoisted = hoistEsbuildModulePaths(code, modulePaths);
          if (hoisted !== code) {
            await writeFile(outputFile, hoisted);
          }
        })
      );
    });
  },
};

// `renderChunk` runs before rolldown hashes the chunk, so file names follow the rewritten code.
export const rolldownHoistedModulePaths: RolldownPlugin = {
  name: 'hoisted-module-paths',
  renderChunk(code) {
    if (!code.includes('node_modules/.pnpm/')) {
      return null;
    }
    return code.replace(
      /^\/\/#region (.+)$/gm,
      (_line, path: string) => `//#region ${hoistModulePath(path)}`
    );
  },
};

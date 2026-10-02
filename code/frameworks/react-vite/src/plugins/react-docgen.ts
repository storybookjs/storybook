import { dirname, relative } from 'node:path';

import { findTsconfigPathForFile, getTsconfigPathsBaseDir } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { createFilter } from '@rollup/pluginutils';
import * as TsconfigPaths from 'tsconfig-paths';
import type { PluginOption } from 'vite';

import { ReactDocgenPool } from './react-docgen-pool.ts';
import { type TsconfigPathsConfig, transformWithReactDocgen } from './react-docgen-transform.ts';

export { getReactDocgenImporter } from './react-docgen-transform.ts';

type Options = {
  include?: string | RegExp | (string | RegExp)[];
  exclude?: string | RegExp | (string | RegExp)[];
};

export async function reactDocgen({
  include = /\.(mjs|tsx?|jsx?)$/,
  exclude = [/node_modules\/.*/],
}: Options = {}): Promise<PluginOption> {
  const cwd = process.cwd();
  const filter = createFilter(include, exclude);
  let usePool = false;
  let pool: ReactDocgenPool | undefined;

  const stopUsingPool = (failedPool: ReactDocgenPool | undefined, reason: unknown) => {
    // Several in-flight transforms can report the same failure; only the first one acts on it.
    if (pool !== failedPool) {
      return;
    }
    usePool = false;
    pool = undefined;
    void failedPool?.close();
    logger.debug(`react-docgen workers unavailable, parsing on the main thread: ${reason}`);
  };

  return {
    name: 'storybook:react-docgen-plugin',
    enforce: 'pre',
    configResolved(config) {
      usePool = config.command === 'build';
    },
    async transform(src: string, id: string) {
      if (!filter(relative(cwd, id))) {
        return;
      }

      const tsconfigPaths = getTsconfigPaths(id);
      // The dev server keeps parsing on the main thread; a build hands its (many, concurrent)
      // transforms to worker threads.
      if (usePool && !pool) {
        try {
          pool = new ReactDocgenPool();
        } catch (error) {
          stopUsingPool(undefined, error);
        }
      }
      const activePool = pool;
      if (activePool) {
        try {
          return await activePool.transform(src, id, tsconfigPaths);
        } catch (error) {
          // A react-docgen error from a working pool is this file's real error.
          if (!activePool.failed) {
            throw error;
          }
          stopUsingPool(activePool, error);
        }
      }
      return transformWithReactDocgen(src, id, tsconfigPaths);
    },
    async buildEnd() {
      await pool?.close();
      pool = undefined;
    },
  };
}

const tsconfigPathsByTsconfigPath = new Map<string, TsconfigPathsConfig>();

function getTsconfigPaths(filePath: string): TsconfigPathsConfig | undefined {
  const tsconfigPath = findTsconfigPathForFile(dirname(filePath), filePath);
  if (!tsconfigPath) {
    return undefined;
  }

  const cached = tsconfigPathsByTsconfigPath.get(tsconfigPath);
  if (cached) {
    return cached;
  }

  const tsconfig = TsconfigPaths.loadConfig(tsconfigPath);

  if (tsconfig.resultType !== 'success') {
    return undefined;
  }

  logger.debug('Using tsconfig paths for react-docgen');
  const tsconfigPaths = {
    configPath: tsconfigPath,
    baseDir: getTsconfigPathsBaseDir(tsconfig.configFileAbsolutePath),
    paths: tsconfig.paths,
  };
  tsconfigPathsByTsconfigPath.set(tsconfigPath, tsconfigPaths);
  return tsconfigPaths;
}

/**
 * This is an isolated file that is registered as a loader in Node. It is used to convert TS to ESM
 * using esbuild. Do _not_ import from other modules in core unless strictly necessary, as it will
 * cause the dist to get huge.
 *
 * This worker-thread loader is the fallback path for Node versions without `module.registerHooks`;
 * newer Nodes get the cheaper in-thread hooks registered by `shared/utils/module.ts`, built on the
 * same helpers from `./loader-utils.ts`.
 */
import { readFile } from 'node:fs/promises';
import type { LoadHook } from 'node:module';
import { fileURLToPath } from 'node:url';

import { transform } from 'esbuild';

import { NODE_TARGET } from '../shared/constants/environments-support.ts';
import { addExtensionsToRelativeImports, isTypeScriptUrl } from './loader-utils.ts';

export const load: LoadHook = async (url, context, nextLoad) => {
  // Strip any query string (e.g. the cache-busting `?<timestamp>` importModule appends for
  // skipCache) before checking the extension, otherwise a cache-busted URL like
  // `file:///main.ts?123` no longer ends with `.ts` and silently skips the esbuild transform below.
  const urlWithoutQuery = url.split('?')[0];

  /** Convert TS to ESM using esbuild */
  if (isTypeScriptUrl(urlWithoutQuery)) {
    const filePath = fileURLToPath(urlWithoutQuery);
    const rawSource = await readFile(filePath, 'utf-8');
    const transformedSource = await transform(rawSource, {
      loader: 'ts',
      target: NODE_TARGET,
      format: 'esm',
      platform: 'neutral',
    });

    // Add extensions to relative imports so Node.js ESM can resolve them
    const sourceWithExtensions = addExtensionsToRelativeImports(transformedSource.code, filePath);

    return {
      format: 'module',
      shortCircuit: true,
      source: sourceWithExtensions,
    };
  }

  return nextLoad(url, context);
};

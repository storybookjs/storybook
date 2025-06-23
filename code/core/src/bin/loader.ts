/**
 * This is an isolated file that is registered as a loader in Node. It is used to convert TS to ESM
 * using esbuild. Do _not_ import from other modules in core unless strictly necessary, as it will
 * cause the dist to get huge.
 */
import { readFile } from 'node:fs/promises';
import type { LoadHook } from 'node:module';
import { fileURLToPath } from 'node:url';

import { transform } from 'esbuild';

import { NODE_TARGET } from '../shared/constants/environments-support';

export const load: LoadHook = async (url, context, nextLoad) => {
  /** Convert TS to ESM using esbuild */
  if (
    url.endsWith('.ts') ||
    url.endsWith('.tsx') ||
    url.endsWith('.mts') ||
    url.endsWith('.cts') ||
    url.endsWith('.tsx') ||
    url.endsWith('.mtsx') ||
    url.endsWith('.ctsx')
  ) {
    const rawSource = await readFile(fileURLToPath(url), 'utf-8');
    const transformedSource = await transform(rawSource, {
      loader: 'ts',
      target: NODE_TARGET,
      format: 'esm',
      platform: 'neutral',
    });

    return {
      format: 'module',
      shortCircuit: true,
      source: transformedSource.code,
    };
  }

  return nextLoad(url, context);
};

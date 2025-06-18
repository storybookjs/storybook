import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { transformSync } from 'esbuild';

export function load(url, context, nextLoad) {
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
    const rawSource = readFileSync(fileURLToPath(url), 'utf-8');
    const transformedSource = transformSync(rawSource.toString(), {
      loader: 'ts',
      target: 'es2020',
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
}

import fs from 'node:fs';
import path, { join } from 'node:path';

import * as nextEnv from '@next/env';
import Log from 'next/dist/build/output/log.js';
import { loadBindings, lockfilePatchPromise } from 'next/dist/build/swc/index.js';
import { findPagesDir } from 'next/dist/lib/find-pages-dir.js';
import type { NextConfigComplete } from 'next/dist/server/config-shared.js';

const nextDistPath =
  /(next[\\/]dist[\\/]shared[\\/]lib)|(next[\\/]dist[\\/]client)|(next[\\/]dist[\\/]pages)/;

const { loadEnvConfig } = ((nextEnv as any).default || nextEnv) as typeof nextEnv;

/** Set up the environment variables for the Next.js project */
export async function loadEnvironmentConfig(dir: string, dev: boolean) {
  return loadEnvConfig(dir, dev, Log);
}

/** Load the SWC bindings eagerly instead of waiting for transform calls */
export async function loadSWCBindingsEagerly(nextConfig?: NextConfigComplete) {
  await loadBindings(nextConfig?.experimental?.useWasmBinary);

  if (lockfilePatchPromise.cur) {
    await lockfilePatchPromise.cur;
  }
}

/** Check if the file should be output as CommonJS */
export function shouldOutputCommonJs(filename: string) {
  return filename.endsWith('.cjs') || nextDistPath.test(filename);
}

/** Load the closest package.json file to the given directory */
export async function loadClosestPackageJson(dir: string, attempts = 1) {
  if (attempts > 5) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error("Can't resolve main package.json file");
  }

  const mainPath = attempts === 1 ? ['.'] : new Array(attempts).fill('..');

  try {
    const file = await fs.promises.readFile(join(dir, ...mainPath, 'package.json'), 'utf8');
    return JSON.parse(file);
  } catch (e) {
    return loadClosestPackageJson(dir, attempts + 1);
  }
}

export function findNextDirectories(dir: string): ReturnType<typeof findPagesDir> {
  try {
    return findPagesDir(dir);
  } catch (e) {
    return {
      appDir: path.join(dir, 'app'),
      pagesDir: path.join(dir, 'pages'),
    };
  }
}

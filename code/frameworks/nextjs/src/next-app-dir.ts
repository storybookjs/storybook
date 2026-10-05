import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

const NEXT_CONFIG_FILES = [
  'next.config.js',
  'next.config.mjs',
  'next.config.cjs',
  'next.config.ts',
  'next.config.mts',
] as const;

const isWithin = (dir: string, root: string) => {
  const path = relative(root, dir);
  return !path.startsWith('..') && !isAbsolute(path);
};

/**
 * The directory of the Next.js app. In a monorepo it can be below the project root (which is the
 * VCS root), and the Babel config sits next to `next.config.*`, not at the project root.
 */
export function resolveNextAppDir(nextConfigPath?: string): string {
  if (nextConfigPath) {
    return dirname(nextConfigPath);
  }

  const projectRoot = getProjectRoot();
  let dir = process.cwd();
  while (isWithin(dir, projectRoot)) {
    if (NEXT_CONFIG_FILES.some((file) => existsSync(join(dir, file)))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return projectRoot;
}

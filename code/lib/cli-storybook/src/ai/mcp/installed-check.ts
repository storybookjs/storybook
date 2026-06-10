import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * Whether `storybook` is resolvable from `cwd`, used to pick between the "start storybook dev"
 * and "set up Storybook first" repairs when nothing is running. Deliberately not a version check:
 * the CLI is invoked as `npx storybook`, so it always runs the project's own Storybook version.
 */
export function isStorybookInstalled(cwd: string): boolean {
  const requireFromCwd = createRequire(join(cwd, 'package.json'));
  const searchPaths = requireFromCwd.resolve.paths('storybook') ?? [];
  return searchPaths.some((base) => existsSync(join(base, 'storybook', 'package.json')));
}

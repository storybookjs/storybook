import { getAddonNames } from 'storybook/internal/common';

import type { Options } from '../../types/index.ts';

/**
 * Whether `@storybook/addon-vitest` is enabled in this project.
 *
 * Reads the `isAddonVitestEnabled` marker that addon's preset exports, so this is true exactly
 * when its presets loaded — the same condition under which its `services` hook registers the
 * `test` toolset. Installed-but-not-enabled (a hoisted monorepo dependency, or an addon removed
 * from `main.ts` without uninstalling) must read false: the toolset never registers there, so
 * offering the tool would make every test call fail.
 */
export async function isAddonVitestEnabled(options: Options): Promise<boolean> {
  try {
    return await options.presets.apply('isAddonVitestEnabled', false);
  } catch {
    return false;
  }
}

/**
 * Whether the main config lists `@storybook/addon-vitest`. Without it a Storybook runs no story
 * tests, so the `AGENTS.md` section leaves the test step out.
 *
 * `create storybook` and `storybook upgrade` write that section without loading the presets, so
 * they read the main config instead of asking `isAddonVitestEnabled`. An addon-vitest that only a
 * preset adds is not seen here.
 */
export function hasAddonVitest(mainConfig: Parameters<typeof getAddonNames>[0]): boolean {
  return getAddonNames(mainConfig).includes('@storybook/addon-vitest');
}

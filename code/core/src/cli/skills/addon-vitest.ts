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

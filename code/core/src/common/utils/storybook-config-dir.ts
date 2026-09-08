import { homedir } from 'node:os';
import { join } from 'node:path';

/** The `~/.storybook` location Storybook has always written per-user files to. */
export function getLegacyStorybookConfigDir(): string {
  return join(homedir(), '.storybook');
}

/**
 * Where Storybook keeps per-user files: `settings.json` and the instance registry.
 *
 * Returns `$XDG_CONFIG_HOME/storybook` when that env var is set, otherwise `~/.storybook`. See
 * https://github.com/storybookjs/storybook/discussions/34405.
 *
 * Reads `process.env` on each call rather than at module load, so a test can set the var and the
 * legacy fallback stays reachable.
 */
export function getStorybookConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();

  if (xdgConfigHome) {
    return join(xdgConfigHome, 'storybook');
  }

  return getLegacyStorybookConfigDir();
}

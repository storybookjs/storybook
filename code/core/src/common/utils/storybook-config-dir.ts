import { homedir } from 'node:os';
import { join } from 'node:path';

/** The `~/.storybook` location Storybook has always written per-user files to. */
export function getLegacyStorybookConfigDir(): string {
  return join(homedir(), '.storybook');
}

/**
 * Where Storybook keeps per-user configuration (`settings.json`).
 *
 * Returns `$XDG_CONFIG_HOME/storybook` when that env var is set, otherwise `~/.storybook`. See
 * https://github.com/storybookjs/storybook/discussions/34405.
 */
export function getStorybookConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();

  if (xdgConfigHome) {
    return join(xdgConfigHome, 'storybook');
  }

  return getLegacyStorybookConfigDir();
}

/**
 * Directory for per-user state, such as the runtime instance registry.
 *
 * Returns `$XDG_STATE_HOME/storybook` when that env var is set, otherwise `~/.storybook`.
 */
export function getStorybookStateDir(): string {
  const xdgStateHome = process.env.XDG_STATE_HOME?.trim();

  if (xdgStateHome) {
    return join(xdgStateHome, 'storybook');
  }

  return getLegacyStorybookConfigDir();
}

/** Directory holding the runtime instance registry files. */
export function getInstanceRegistryDir(): string {
  return join(getStorybookStateDir(), 'instances');
}

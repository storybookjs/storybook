import { access, cp } from 'node:fs/promises';
import { join } from 'node:path';

import { getLegacyStorybookConfigDir, getStorybookConfigDir } from './storybook-config-dir.ts';

const SETTINGS_FILE = 'settings.json';

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  );

/**
 * Copy an existing `~/.storybook/settings.json` to the XDG config location the first time
 * Storybook runs there, for users who set `XDG_CONFIG_HOME`. Checks the destination file itself
 * rather than its parent directory, and never overwrites an existing destination. See #34405.
 */
export async function migrateLegacySettings() {
  const legacyDir = getLegacyStorybookConfigDir();
  const targetDir = getStorybookConfigDir();

  if (targetDir === legacyDir) {
    return;
  }

  const source = join(legacyDir, SETTINGS_FILE);
  const destination = join(targetDir, SETTINGS_FILE);

  if ((await exists(destination)) || !(await exists(source))) {
    return;
  }

  await cp(source, destination);
}

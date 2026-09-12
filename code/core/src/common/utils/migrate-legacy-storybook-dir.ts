import { access, cp } from 'node:fs/promises';
import { join } from 'node:path';

import {
  getLegacyStorybookConfigDir,
  getStorybookConfigDir,
  getStorybookStateDir,
} from './storybook-config-dir.ts';

const CONFIG_ENTRIES = ['settings.json'];
const STATE_ENTRIES = ['instances'];

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  );

async function copyLegacyEntries(legacyDir: string, targetDir: string, entries: string[]) {
  // Nothing to do when the target is the legacy directory itself, or it already exists.
  if (targetDir === legacyDir || (await exists(targetDir))) {
    return;
  }

  for (const entry of entries) {
    const source = join(legacyDir, entry);

    if (await exists(source)) {
      await cp(source, join(targetDir, entry), { recursive: true });
    }
  }
}

/**
 * Copy `~/.storybook` into the XDG locations once, for users who set `XDG_CONFIG_HOME` or
 * `XDG_STATE_HOME`. Files are copied rather than moved so older Storybook versions keep working,
 * and the copy is skipped as soon as the target directory exists. See #34405.
 */
export async function migrateLegacyStorybookDir() {
  const legacyDir = getLegacyStorybookConfigDir();

  await copyLegacyEntries(legacyDir, getStorybookConfigDir(), CONFIG_ENTRIES);
  await copyLegacyEntries(legacyDir, getStorybookStateDir(), STATE_ENTRIES);
}

import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import type { JsPackageManager } from '../js-package-manager/index.ts';
import { normalizeAddonName } from './get-addon-names.ts';
import { getConfigInfo } from './get-storybook-info.ts';

export type RemoveAddonOptions = {
  packageManager: JsPackageManager;
  configDir?: string;
  skipInstall?: boolean;
};

/**
 * Remove the given addon package and remove it from main.js
 *
 * @example
 *
 * ```sh
 * sb remove @storybook/addon-links
 * ```
 */
export async function removeAddon(addon: string, options: RemoveAddonOptions) {
  const { packageManager, skipInstall } = options;

  const { mainConfigPath, configDir } = getConfigInfo(options.configDir);

  if (typeof configDir === 'undefined') {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(dedent`
      Unable to find storybook config directory
    `);
  }

  if (!mainConfigPath) {
    logger.error('Unable to find storybook main.js config');
    return;
  }
  const main = await readConfig(mainConfigPath);

  // remove from package.json
  logger.debug(`Uninstalling ${addon}`);
  await packageManager.removeDependencies([addon]);

  if (!skipInstall) {
    await packageManager.installDependencies();
  }

  try {
    // The index of every entry that names the addon, such as `'<addon>/preset'` or an absolute
    // path to it: `getNamesFromPath` reads one name per element.
    const indexes = (main.getNamesFromPath(['addons']) ?? []).flatMap((name, index) =>
      normalizeAddonName(name) === addon ? [index] : []
    );

    // Fault tolerant as the addon might have been removed already
    if (indexes.length > 0) {
      logger.debug(`Removing '${addon}' from main.js addons field.`);
      // From the last, so the indexes before it still address the same entries.
      indexes.reverse().forEach((index) => main.remove(['addons', index]));
      await writeConfig(main);
    }
  } catch (err) {
    logger.warn(`Failed to remove '${addon}' from main.js addons field. ${String(err)}`);
  }
}

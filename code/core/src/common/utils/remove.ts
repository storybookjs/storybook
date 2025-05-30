import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { prompt } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import type { JsPackageManager } from '../js-package-manager';
import { getConfigInfo } from './get-storybook-info';

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
    prompt.error('Unable to find storybook main.js config');
    return;
  }
  const main = await readConfig(mainConfigPath);

  // remove from package.json
  prompt.debug(`Uninstalling ${addon}`);
  await packageManager.removeDependencies([addon]);

  if (!skipInstall) {
    await packageManager.installDependencies();
  }

  const currentAddons = main.getNamesFromPath(['addons']) ?? [];

  // Fault tolerant as the addon might have been removed already
  if (currentAddons.includes(addon)) {
    // add to main.js
    prompt.debug(`Removing '${addon}' from main.js addons field.`);
    try {
      main.removeEntryFromArray(['addons'], addon);
      await writeConfig(main);
    } catch (err) {
      prompt.warn(`Failed to remove '${addon}' from main.js addons field. ${String(err)}`);
    }
  }
}

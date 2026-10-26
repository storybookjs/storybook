import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { findConfigFile, loadMainConfig } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { RN_STORYBOOK_DIR } from '../../../../../core/src/shared/constants/config-folder.ts';

const SIBLING_CONFIG_DIR: Record<string, string> = {
  '.storybook': RN_STORYBOOK_DIR,
  [RN_STORYBOOK_DIR]: '.storybook',
};

// `@storybook/react-native-web-vite` mains are web mains and keep their `addons`.
const needsRename = (mainConfigPath: string, config: StorybookConfigRaw) =>
  (basename(dirname(mainConfigPath)) === RN_STORYBOOK_DIR ||
    getFrameworkPackageName(config) === '@storybook/react-native') &&
  Array.isArray(config.addons) &&
  config.addons.length > 0 &&
  (config as { deviceAddons?: unknown }).deviceAddons === undefined;

// Storybook Core evaluates every `addons` entry as a Node.js preset, which on-device addons must not be.
export const rnOndeviceAddonsToDeviceAddons: Fix<{ targets: { mainConfigPath: string }[] }> = {
  id: 'rn-ondevice-addons-to-device-addons',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-native-on-device-addons-moved-to-deviceaddons',

  async check({ mainConfig, packageManager, configDir, mainConfigPath }) {
    if (!packageManager.getAllDependencies()['@storybook/react-native']) {
      return null;
    }

    const targets: { mainConfigPath: string }[] = [];

    if (configDir) {
      const absConfigDir = resolve(configDir);
      const siblingName = SIBLING_CONFIG_DIR[basename(absConfigDir)];
      const siblingDir = siblingName && join(dirname(absConfigDir), siblingName);
      const candidateDirs =
        siblingDir && existsSync(siblingDir) ? [absConfigDir, siblingDir] : [absConfigDir];

      for (const dir of candidateDirs) {
        const mainPath = findConfigFile('main', dir);
        if (!mainPath) {
          continue;
        }

        let config = mainConfig;
        if (!mainConfigPath || resolve(mainConfigPath) !== resolve(mainPath)) {
          try {
            config = (await loadMainConfig({ configDir: dir })) as StorybookConfigRaw;
          } catch (e) {
            logger.debug(
              `Failed to load Storybook main config at ${dir}: ${e instanceof Error ? e.message : String(e)}`
            );
            continue;
          }
        }

        if (needsRename(mainPath, config)) {
          targets.push({ mainConfigPath: mainPath });
        }
      }
    } else if (mainConfigPath && needsRename(mainConfigPath, mainConfig)) {
      targets.push({ mainConfigPath });
    }

    return targets.length > 0 ? { targets } : null;
  },

  prompt() {
    return 'Renaming `addons` to `deviceAddons` in your React Native Storybook config (on-device addons must not be evaluated as Node.js presets).';
  },

  async run({ result, files }) {
    for (const { mainConfigPath } of result.targets) {
      await files.editConfig(mainConfigPath, (main) => main.rename(['addons'], 'deviceAddons'));
    }
  },
};

import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

import { findConfigFile, loadMainConfig } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { getFrameworkPackageName, updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { RN_STORYBOOK_DIR } from '../../../../../core/src/shared/constants/config-folder.ts';

interface RnOndeviceAddonsTarget {
  mainConfigPath: string;
}

interface RnOndeviceAddonsOptions {
  targets: RnOndeviceAddonsTarget[];
}

const resolveAbsoluteConfigDir = (configDir: string): string =>
  isAbsolute(configDir) ? configDir : join(process.cwd(), configDir);

/**
 * When the project uses both `.storybook` (web) and `.rnstorybook` (on-device), return the sibling
 * config directory path if it exists.
 */
const getSiblingStorybookConfigDir = (configDirAbs: string): string | null => {
  const base = basename(configDirAbs);
  const parent = dirname(configDirAbs);
  if (base === '.storybook') {
    const rn = join(parent, RN_STORYBOOK_DIR);
    return existsSync(rn) ? rn : null;
  }
  if (base === RN_STORYBOOK_DIR) {
    const web = join(parent, '.storybook');
    return existsSync(web) ? web : null;
  }
  return null;
};

/**
 * A main config is treated as a React Native main when EITHER its directory is `.rnstorybook`, OR
 * its `framework` field resolves to `@storybook/react-native`. Web frameworks (notably
 * `@storybook/react-native-web-vite`) are not React Native mains.
 */
const isReactNativeMain = (mainConfigPath: string, mainConfig: StorybookConfigRaw): boolean => {
  if (basename(dirname(mainConfigPath)) === RN_STORYBOOK_DIR) {
    return true;
  }
  return getFrameworkPackageName(mainConfig) === '@storybook/react-native';
};

const hasAddonsToRename = (cfg: StorybookConfigRaw): boolean => {
  const addons = cfg.addons;
  if (!Array.isArray(addons) || addons.length === 0) {
    return false;
  }
  // Idempotency: don't touch a config that already has `deviceAddons` to avoid clobbering it.
  // `deviceAddons` is not part of the core StorybookConfigRaw type — it lives in the RN framework
  // package — so we cast to access it without touching the shared type definition.
  if ((cfg as { deviceAddons?: unknown }).deviceAddons !== undefined) {
    return false;
  }
  return true;
};

/**
 * Automigration: rename the `addons` key to `deviceAddons` in React Native Storybook main configs.
 * On-device addons must not be evaluated as Node.js presets, which Storybook Core does for every
 * entry in `addons`. Web framework main configs are left untouched.
 */
export const rnOndeviceAddonsToDeviceAddons: Fix<RnOndeviceAddonsOptions> = {
  id: 'rn-ondevice-addons-to-device-addons',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-native-on-device-addons-moved-to-deviceaddons',

  async check({ mainConfig, packageManager, configDir, mainConfigPath }) {
    const allDependencies = packageManager.getAllDependencies();

    if (!allDependencies['@storybook/react-native']) {
      return null;
    }

    const candidateDirs: string[] = [];
    if (configDir) {
      const absConfigDir = resolveAbsoluteConfigDir(configDir);
      candidateDirs.push(absConfigDir);
      const siblingConfigDir = getSiblingStorybookConfigDir(absConfigDir);
      if (siblingConfigDir) {
        candidateDirs.push(siblingConfigDir);
      }
    }

    const targets: RnOndeviceAddonsTarget[] = [];
    const seenResolvedMainPaths = new Set<string>();

    if (candidateDirs.length > 0) {
      for (const dir of candidateDirs) {
        const mainPath = findConfigFile('main', dir);
        if (!mainPath) {
          continue;
        }
        const resolvedMain = resolve(mainPath);
        if (seenResolvedMainPaths.has(resolvedMain)) {
          continue;
        }
        seenResolvedMainPaths.add(resolvedMain);

        let cfg: StorybookConfigRaw;
        if (mainConfigPath && resolve(mainConfigPath) === resolvedMain) {
          cfg = mainConfig;
        } else {
          try {
            cfg = (await loadMainConfig({ configDir: dir })) as StorybookConfigRaw;
          } catch (e) {
            logger.debug(
              `Failed to load Storybook main config at ${dir}: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
            continue;
          }
        }

        if (!isReactNativeMain(mainPath, cfg)) {
          continue;
        }
        if (!hasAddonsToRename(cfg)) {
          continue;
        }
        targets.push({ mainConfigPath: mainPath });
      }
    } else if (mainConfigPath) {
      if (isReactNativeMain(mainConfigPath, mainConfig) && hasAddonsToRename(mainConfig)) {
        targets.push({ mainConfigPath });
      }
    }

    if (targets.length === 0) {
      return null;
    }

    return { targets };
  },

  prompt() {
    return 'Renaming `addons` to `deviceAddons` in your React Native Storybook config (on-device addons must not be evaluated as Node.js presets).';
  },

  async run({ result, dryRun }) {
    for (const { mainConfigPath } of result.targets) {
      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, (main) => {
        const node = main.getFieldNode(['addons']);
        if (!node) {
          return;
        }
        main.setFieldNode(['deviceAddons'], node as any);
        main.removeField(['addons']);
      });
    }
  },
};

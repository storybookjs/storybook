import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

import { findConfigFile, loadMainConfig } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Preset, StorybookConfigRaw } from 'storybook/internal/types';

import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

interface RnOndeviceAddonsTarget {
  mainConfigPath: string;
  ondeviceAddons: Preset[];
}

interface RnOndeviceAddonsOptions {
  targets: RnOndeviceAddonsTarget[];
}

const getAddonName = (addon: Preset): string => (typeof addon === 'string' ? addon : addon.name);

const filterOndeviceAddons = (addons: Preset[] | undefined): Preset[] =>
  (addons ?? []).filter((addon) => getAddonName(addon).includes('ondevice'));

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
    const rn = join(parent, '.rnstorybook');
    return existsSync(rn) ? rn : null;
  }
  if (base === '.rnstorybook') {
    const web = join(parent, '.storybook');
    return existsSync(web) ? web : null;
  }
  return null;
};

/** True when at least one `main` still has on-device entries in `addons` (not yet in `deviceAddons`). */
const anyMainHasOndeviceAddonsToMove = (targets: RnOndeviceAddonsTarget[]): boolean =>
  targets.some((target) => target.ondeviceAddons.length > 0);

/**
 * Automigration: move on-device addons (those with "ondevice" in the name) from `addons` to
 * `deviceAddons` in the Storybook config for `@storybook/react-native` projects.
 */
export const rnOndeviceAddonsToDeviceAddons: Fix<RnOndeviceAddonsOptions> = {
  id: 'rn-ondevice-addons-to-device-addons',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-native-on-device-addons-moved-to-deviceaddons',

  async check({ mainConfig, packageManager, configDir, mainConfigPath }) {
    const allDependencies = packageManager.getAllDependencies();

    if (!allDependencies['@storybook/react-native']) {
      return null;
    }

    // If a sibling config folder exists, add its `main` alongside the active one so we migrate both.
    if (configDir) {
      const absConfigDir = resolveAbsoluteConfigDir(configDir);
      const siblingConfigDir = getSiblingStorybookConfigDir(absConfigDir);
      if (siblingConfigDir) {
        const targets: RnOndeviceAddonsTarget[] = [];
        const seenResolvedMainPaths = new Set<string>();

        for (const dir of [absConfigDir, siblingConfigDir]) {
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

          targets.push({
            mainConfigPath: mainPath,
            ondeviceAddons: filterOndeviceAddons(cfg.addons),
          });
        }

        if (anyMainHasOndeviceAddonsToMove(targets)) {
          return { targets };
        }
        return null;
      }
    }

    if (!mainConfigPath) {
      return null;
    }

    const ondeviceAddons = filterOndeviceAddons(mainConfig.addons);
    if (ondeviceAddons.length === 0) {
      return null;
    }

    return { targets: [{ mainConfigPath, ondeviceAddons }] };
  },

  prompt() {
    return 'On-device addons detected. Moving to `deviceAddons` for on-device injection (Skipping Storybook preset loading);
  },

  async run({ result, dryRun }) {
    for (const { mainConfigPath, ondeviceAddons } of result.targets) {
      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, (main) => {
        for (const addon of ondeviceAddons) {
          const name = getAddonName(addon);
          main.removeEntryFromArray(['addons'], name);
          main.appendValueToArray(['deviceAddons'], addon);
        }
      });
    }
  },
};

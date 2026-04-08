import type { Preset } from 'storybook/internal/types';

import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

interface RnOndeviceAddonsOptions {
  ondeviceAddons: Preset[];
}

const getAddonName = (addon: Preset): string => (typeof addon === 'string' ? addon : addon.name);

/**
 * Automigration: move on-device addons (those with "ondevice" in the name) from `addons` to
 * `deviceAddons` in the Storybook config for `@storybook/react-native` projects.
 */
export const rnOndeviceAddonsToDeviceAddons: Fix<RnOndeviceAddonsOptions> = {
  id: 'rn-ondevice-addons-to-device-addons',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-native-on-device-addons-moved-to-deviceaddons',

  async check({ mainConfig, packageManager }) {
    const allDependencies = packageManager.getAllDependencies();

    if (!allDependencies['@storybook/react-native']) {
      return null;
    }

    const addons: Preset[] = mainConfig.addons ?? [];
    const ondeviceAddons = addons.filter((addon) => getAddonName(addon).includes('ondevice'));

    if (ondeviceAddons.length === 0) {
      return null;
    }

    return { ondeviceAddons };
  },

  prompt() {
    return 'We detected on-device addons (addons with "ondevice" in their name) in your `addons` config. For `@storybook/react-native`, these should be placed in `deviceAddons` so they are only injected on-device and not evaluated as Storybook Core presets.';
  },

  async run({ result, dryRun, mainConfigPath }) {
    const { ondeviceAddons } = result;

    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, (main) => {
      for (const addon of ondeviceAddons) {
        const name = getAddonName(addon);
        main.removeEntryFromArray(['addons'], name);
        main.appendValueToArray(['deviceAddons'], addon);
      }
    });
  },
};

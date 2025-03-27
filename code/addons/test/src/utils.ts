import type { StorybookConfig } from 'storybook/internal/types';

export function getAddonNames(mainConfig: StorybookConfig): string[] {
  const addons = mainConfig.addons || [];
  const addonList = addons.map((addon) => {
    let name = '';
    if (typeof addon === 'string') {
      name = addon;
    } else if (typeof addon === 'object') {
      name = addon.name;
    }

    return name;
  });

  return addonList.filter((item): item is NonNullable<typeof item> => item != null);
}

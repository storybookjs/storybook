import type { StorybookConfig } from '@storybook/types';

export const getAddonNames = (mainConfig: StorybookConfig): string[] => {
  const addons = mainConfig.addons || [];
  const addonList = addons.map((addon) => {
    let name = '';
    if (typeof addon === 'string') {
      name = addon;
    } else if (typeof addon === 'object') {
      name = addon.name;
    }

    if (name.startsWith('.')) {
      return undefined;
    }

    // For absolute paths, pnpm and yarn pnp,
    // Remove everything before and including "node_modules/"
    name = name.replace(/.*node_modules\//, '');

    // Further clean up package names
    return name
      .replace(/\/dist\/.*$/, '')
      .replace(/\.[mc]?[tj]?sx?$/, '')
      .replace(/\/register$/, '')
      .replace(/\/manager$/, '')
      .replace(/\/preset$/, '');
  });

  return addonList.filter((item): item is NonNullable<typeof item> => item != null);
};

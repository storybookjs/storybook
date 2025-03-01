import path from 'node:path';

import { isCorePackage } from './cli';

/**
 * Get the name of the annotations object for a given addon.
 *
 * Input: '@storybook/addon-essentials'
 *
 * Output: 'addonEssentialsAnnotations'
 */
export function getAnnotationsName(addonName: string): string {
  // remove @storybook namespace, split by special characters, convert to camelCase
  const cleanedUpName = addonName
    .replace(/^@storybook\//, '')
    .split(/[^a-zA-Z0-9]+/)
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('')
    .replace(/^./, (char) => char.toLowerCase());

  return cleanedUpName;
}

export async function getAddonAnnotations(addon: string) {
  try {
    const data = {
      // core addons will have a function as default export in index entrypoint
      importPath: addon,
      importName: getAnnotationsName(addon),
      isCoreAddon: isCorePackage(addon),
    };

    if (addon === '@storybook/addon-essentials') {
      data.importPath = '@storybook/addon-essentials/entry-preview';
      return data;
    } else if (!data.isCoreAddon) {
      // for backwards compatibility, if it's not a core addon we use /preview entrypoint
      data.importPath = `${addon}/preview`;
    }

    require.resolve(path.join(addon, 'preview'));

    return data;
  } catch (err) {}

  return null;
}

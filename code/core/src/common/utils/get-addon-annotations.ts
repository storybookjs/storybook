import { createRequire } from 'node:module';

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

// TODO: test this
export async function getAddonAnnotations(addon: string, configDir: string) {
  const data = {
    // core addons will have a function as default export in index entrypoint
    importPath: addon,
    importName: getAnnotationsName(addon),
    isCoreAddon: isCorePackage(addon),
  };

  if (!data.isCoreAddon) {
    // for backwards compatibility, if it's not a core addon we use /preview entrypoint
    data.importPath = `${addon}/preview`;
  }

  // If the preview endpoint doesn't exist, we don't need to add the addon to definePreview
  try {
    const require = createRequire(import.meta.url);
    require.resolve(`${addon}/preview`, { paths: [configDir] });
  } catch (err) {
    return null;
  }
  return data;
}

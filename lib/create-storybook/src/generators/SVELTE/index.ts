import { getVersionSafe } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

import { major } from 'semver';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

export const getAddonSvelteCsfVersion = async (packageManager: JsPackageManager) => {
  const svelteVersion = await getVersionSafe(packageManager, 'svelte');
  try {
    const svelteMajor = major(svelteVersion ?? '');
    if (svelteMajor === 4) {
      return '4';
    }
    // TODO: update when addon-svelte-csf v5 is released
    if (svelteMajor === 5) {
      return '^5.0.0-next.0';
    }
  } catch {
    // fallback to latest version
  }
  return '';
};

const generator: Generator = async (packageManager, npmOptions, options) => {
  const addonSvelteCsfVersion = await getAddonSvelteCsfVersion(packageManager);

  await baseGenerator(packageManager, npmOptions, options, 'svelte', {
    extensions: ['js', 'ts', 'svelte'],
    extraAddons: [
      `@storybook/addon-svelte-csf${addonSvelteCsfVersion && `@${addonSvelteCsfVersion}`}`,
    ],
  });
};

export default generator;

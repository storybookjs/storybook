import { major } from 'semver';

import { getVersionSafe } from '../../../../../core/src/cli/helpers';
import type { JsPackageManager } from '../../../../../core/src/common/js-package-manager/JsPackageManager';
import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

export const getAddonSvelteCsfVersion = async (packageManager: JsPackageManager) => {
  const svelteVersion = await getVersionSafe(packageManager as any, 'svelte');
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

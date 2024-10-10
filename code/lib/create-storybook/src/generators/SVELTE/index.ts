import { coerce, major } from 'semver'

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';
import { JsPackageManager } from '@storybook/core/common';

const versionHelper = (svelteMajor?: number) => {
  if(svelteMajor === 4) return '4';
  // TODO: update when addon-svelte-csf v5 is released
  if(svelteMajor === 5) return '^5.0.0-next.0';
  return '';
}

export const getAddonSvelteCsfVersion = async (packageManager: JsPackageManager) => {
  const svelteVersion = await packageManager.getInstalledVersion('svelte');
  if(svelteVersion) {
    return versionHelper(major(svelteVersion));
  } else {
    const deps = await packageManager.getAllDependencies();
    const svelteSpecifier = deps['svelte'];
    try {
      const coerced = coerce(svelteSpecifier);
      if(coerced?.version) {
        return versionHelper(major(coerced.version));
      }
    } catch {}
  }
  return '';
}

const generator: Generator = async (packageManager, npmOptions, options) => {
  const addonSvelteCsfVersion = await getAddonSvelteCsfVersion(packageManager);

  await baseGenerator(packageManager, npmOptions, options, 'svelte', {
    extensions: ['js', 'ts', 'svelte'],
    extraAddons: [`@storybook/addon-svelte-csf${addonSvelteCsfVersion && `@${addonSvelteCsfVersion}`}`],
  });
};

export default generator;

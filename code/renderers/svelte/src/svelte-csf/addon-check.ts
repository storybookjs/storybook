import { normalizeAddonName } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { SvelteCsfAddonInstalledError } from './errors.ts';

interface Params extends Pick<Options, 'presetsList'> {
  // The `framework` entry of the main config
  framework: string | { name: string } | undefined;
}

// Running the addon next to the built-in Svelte CSF registers two indexers and two transforms
export function assertSvelteCsfAddonNotInstalled({ presetsList, framework }: Params) {
  const addon = presetsList?.find(
    (preset) => normalizeAddonName(preset.name) === '@storybook/addon-svelte-csf'
  );

  if (addon) {
    throw new SvelteCsfAddonInstalledError({
      frameworkPackage: normalizeAddonName(
        typeof framework === 'string' ? framework : (framework?.name ?? '')
      ),
      legacyTemplate: addon.options?.legacyTemplate === true,
    });
  }
}

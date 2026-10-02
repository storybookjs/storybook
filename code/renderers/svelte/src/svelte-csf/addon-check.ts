import { normalizeAddonName } from 'storybook/internal/common';
import { SvelteCsfAddonInstalledError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

// Running the addon next to the built-in Svelte CSF registers two indexers and two transforms
export function assertSvelteCsfAddonNotInstalled(options: Pick<Options, 'presetsList'>) {
  const addon = options.presetsList?.find(
    (preset) => normalizeAddonName(preset.name) === '@storybook/addon-svelte-csf'
  );

  if (addon) {
    throw new SvelteCsfAddonInstalledError({
      legacyTemplate: addon.options?.legacyTemplate === true,
    });
  }
}

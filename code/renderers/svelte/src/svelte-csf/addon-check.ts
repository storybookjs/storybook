import { normalizeAddonName } from '@storybook/core/internal/common';
import type { Storybook } from '@storybook/core';

import { SvelteCsfAddonInstalledError } from './errors.ts';

interface InstanceParams {
  storybook: Pick<Storybook, 'hasAddon' | 'options'>;
  // The `framework` entry of the main config
  framework: string | { name: string } | undefined;
}

const ADDON_NAME = '@storybook/addon-svelte-csf';

/** Running the addon next to the built-in Svelte CSF registers two indexers and two transforms. */
export function assertSvelteCsfAddonNotInstalledOnInstance({
  storybook,
  framework,
}: InstanceParams): void {
  if (!storybook.hasAddon(ADDON_NAME)) {
    return;
  }

  const legacyTemplate = (storybook.options.main.addons ?? []).some(
    (addon) =>
      typeof addon === 'object' &&
      'name' in addon &&
      normalizeAddonName(addon) === ADDON_NAME &&
      addon.options?.legacyTemplate === true
  );

  throwInstalled(framework, legacyTemplate);
}

function throwInstalled(framework: InstanceParams['framework'], legacyTemplate: boolean): never {
  throw new SvelteCsfAddonInstalledError({
    frameworkPackage: normalizeAddonName(
      typeof framework === 'string' ? framework : (framework?.name ?? '')
    ),
    legacyTemplate,
  });
}

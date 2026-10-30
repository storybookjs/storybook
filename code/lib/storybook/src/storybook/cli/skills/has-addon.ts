import { getAddonNames, loadMainConfig } from '@storybook/core/internal/common';
import { getInstanceContext } from '@storybook/core/internal/deep/shared/instance-context';
import type { Options } from '@storybook/core/internal/types';

/** Reads the instance's addons, or `main.addons` for callers such as addon-mcp that have none. */
export async function hasAddon(
  options: Pick<Options, 'configDir'>,
  name: string
): Promise<boolean> {
  const storybook = getInstanceContext()?.storybook;
  if (storybook) {
    return storybook.hasAddon(name);
  }
  try {
    return getAddonNames(await loadMainConfig({ configDir: options.configDir })).includes(name);
  } catch {
    return false;
  }
}

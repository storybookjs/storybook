import type { ConfigFile } from 'storybook/internal/csf-tools';
import { parseExpression, writeConfig } from 'storybook/internal/csf-tools';

import { loadMainConfig } from './load-main-config.ts';
import { syncStorybookAddons } from './sync-main-preview-addons.ts';
import { getAbsolutePathCall, getAbsolutePathWrapperName } from './wrap-getAbsolutePath-utils.ts';

export interface SetupAddonInConfigOptions {
  addonName: string;
  mainConfigCSFFile: ConfigFile;
  previewConfigPath: string | undefined;
  configDir: string;
}

/**
 * Setup an addon in the Storybook configuration by adding it to the addons array in main config and
 * syncing it with preview config.
 *
 * @param options Configuration options for setting up the addon
 */
export async function setupAddonInConfig({
  addonName,
  previewConfigPath,
  configDir,
  mainConfigCSFFile,
}: SetupAddonInConfigOptions): Promise<void> {
  const addons = mainConfigCSFFile._arrayAt(['addons']);
  if (addons.kind === 'other') {
    throw new Error(addons.diagnostic.message);
  }
  const wrapped = addons.kind === 'array' && getAbsolutePathWrapperName(mainConfigCSFFile) !== null;
  const result = mainConfigCSFFile.append(
    ['addons'],
    wrapped ? parseExpression(getAbsolutePathCall(mainConfigCSFFile, addonName)) : addonName
  );
  if (!result.ok) {
    throw new Error(result.diagnostic.message);
  }

  await writeConfig(mainConfigCSFFile);

  // TODO: remove try/catch once CSF factories is shipped, for now gracefully handle any error
  try {
    const newMainConfig = await loadMainConfig({ configDir, skipCache: true });

    if (previewConfigPath) {
      await syncStorybookAddons(newMainConfig, previewConfigPath, configDir);
    }
  } catch (e) {
    //
  }
}

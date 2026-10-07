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
  const mainConfigAddons = mainConfigCSFFile.getFieldNode(['addons']);
  if (mainConfigAddons && getAbsolutePathWrapperName(mainConfigCSFFile) !== null) {
    mainConfigCSFFile.appendNodeToArray(
      ['addons'],
      parseExpression(getAbsolutePathCall(mainConfigCSFFile, addonName))
    );
  } else {
    mainConfigCSFFile.appendValueToArray(['addons'], addonName);
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

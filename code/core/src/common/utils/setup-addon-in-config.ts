import type { ConfigFile } from 'storybook/internal/csf-tools';
import { writeConfig } from 'storybook/internal/csf-tools';
import type { StorybookConfig } from 'storybook/internal/types';

import { syncStorybookAddons } from './sync-main-preview-addons';
import {
  getAbsolutePathWrapperName,
  wrapValueWithGetAbsolutePathWrapper,
} from './wrap-getAbsolutePath-utils';

export interface SetupAddonInConfigOptions {
  addonName: string;
  mainConfigCSFFile: ConfigFile;
  previewConfigPath: string | undefined;
  configDir: string;
  mainConfig: StorybookConfig;
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
  mainConfig,
}: SetupAddonInConfigOptions): Promise<void> {
  const mainConfigAddons = mainConfigCSFFile.getFieldNode(['addons']);
  if (mainConfigAddons && getAbsolutePathWrapperName(mainConfigCSFFile) !== null) {
    const addonNode = mainConfigCSFFile.valueToNode(addonName);
    mainConfigCSFFile.appendNodeToArray(['addons'], addonNode as any);
    wrapValueWithGetAbsolutePathWrapper(mainConfigCSFFile, addonNode as any);
  } else {
    mainConfigCSFFile.appendValueToArray(['addons'], addonName);
  }

  await writeConfig(mainConfigCSFFile);

  // TODO: remove try/catch once CSF factories is shipped, for now gracefully handle any error
  try {
    await syncStorybookAddons(mainConfig, previewConfigPath!, configDir);
  } catch (e) {
    //
  }
}

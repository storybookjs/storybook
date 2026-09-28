import { writeFile } from 'node:fs/promises';

import type { ConfigFile } from 'storybook/internal/csf-tools';
import { formatConfig } from 'storybook/internal/csf-tools';

import { formatExistingFile } from './formatter.ts';

import { loadMainConfig } from './load-main-config.ts';
import { syncStorybookAddons } from './sync-main-preview-addons.ts';
import {
  getAbsolutePathWrapperName,
  wrapValueWithGetAbsolutePathWrapper,
} from './wrap-getAbsolutePath-utils.ts';

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
    const addonNode = mainConfigCSFFile.valueToNode(addonName);
    mainConfigCSFFile.appendNodeToArray(['addons'], addonNode as any);
    wrapValueWithGetAbsolutePathWrapper(mainConfigCSFFile, addonNode as any);
  } else {
    mainConfigCSFFile.appendValueToArray(['addons'], addonName);
  }

  const [diagnostic] = mainConfigCSFFile.mutationDiagnostics;
  if (diagnostic) {
    throw new Error(diagnostic.message);
  }
  const fileName = mainConfigCSFFile.fileName!;
  await writeFile(fileName, await formatExistingFile(fileName, formatConfig(mainConfigCSFFile)));

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

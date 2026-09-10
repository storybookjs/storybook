import { readFile, writeFile } from 'node:fs/promises';

import type { ConfigFile } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';
import { assertConfigMutationSuccess } from '../helpers/config-object.ts';

interface Options {
  previewConfig: ConfigFile;
  previewConfigPath: string;
}

/** Rename preview.js globals to initialGlobals */
export const initialGlobals: Fix<Options> = {
  id: 'initial-globals',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#previewjs-globals-renamed-to-initialglobals',

  async check({ previewConfigPath }) {
    if (!previewConfigPath) {
      return null;
    }

    const previewConfig = loadConfig((await readFile(previewConfigPath)).toString()).parse();
    const globals = previewConfig.get(['globals']);
    assertConfigMutationSuccess(previewConfig);

    if (!globals) {
      return null;
    }

    return { previewConfig, previewConfigPath };
  },

  prompt() {
    return `Rename ${picocolors.cyan('globals')} to ${picocolors.cyan('initialGlobals')} in preview.js?`;
  },

  async run({ dryRun, result }) {
    result.previewConfig.rename(['globals'], 'initialGlobals');
    assertConfigMutationSuccess(result.previewConfig);
    if (!dryRun) {
      await writeFile(result.previewConfigPath, formatConfig(result.previewConfig));
    }
  },
};

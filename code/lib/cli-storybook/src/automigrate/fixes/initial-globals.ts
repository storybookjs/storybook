import { readFile, writeFile } from 'node:fs/promises';

import type { types } from 'storybook/internal/babel';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types';

interface Options {
  previewConfig: ConfigFile;
  previewConfigPath: string;
  globals: types.Expression;
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
    const globals = previewConfig.getFieldNode(['globals']) as types.Expression;

    if (!globals) {
      return null;
    }

    return { globals, previewConfig, previewConfigPath };
  },

  prompt() {
    return `Rename ${picocolors.cyan('globals')} to ${picocolors.cyan('initialGlobals')} in preview.js?`;
  },

  async run({ dryRun, result }) {
    result.previewConfig.removeField(['globals']);
    result.previewConfig.setFieldNode(['initialGlobals'], result.globals);
    if (!dryRun) {
      await writeFile(result.previewConfigPath, formatConfig(result.previewConfig));
    }
  },
};

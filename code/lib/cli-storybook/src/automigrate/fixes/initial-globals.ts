import { readFile, writeFile } from 'node:fs/promises';

import type { ConfigFile } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import type { Expression } from '@babel/types';
import picocolors from 'picocolors';

import type { Fix } from '../types';

interface Options {
  previewConfig: ConfigFile;
  previewConfigPath: string;
  globals: Expression;
}

/** Rename preview.js globals to initialGlobals */
export const initialGlobals: Fix<Options> = {
  id: 'initial-globals',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#previewjs-globals-renamed-to-initialglobals',

  async check({ previewConfigPath }) {
    if (!previewConfigPath) {
      return null;
    }

    const previewConfig = loadConfig((await readFile(previewConfigPath)).toString()).parse();
    const globals = previewConfig.getFieldNode(['globals']) as Expression;

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

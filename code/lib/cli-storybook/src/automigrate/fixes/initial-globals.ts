import { readFile, writeFile } from 'node:fs/promises';

import type { ConfigFile } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import type { Expression } from '@babel/types';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

const MIGRATION =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#previewjs-globals-renamed-to-initialglobals';

interface Options {
  previewConfig: ConfigFile;
  previewConfigPath: string;
  globals: Expression;
}

/** Rename preview.js globals to initialGlobals */
export const initialGlobals: Fix<Options> = {
  id: 'initial-globals',
  versionRange: ['*.*.*', '>=8.0.*'],
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

  prompt({ previewConfigPath }) {
    return dedent`
      The ${picocolors.cyan('globals')} setting in ${picocolors.cyan(
        previewConfigPath
      )} is deprecated
      and has been renamed to ${picocolors.cyan('initialGlobals')}.
        
      Learn more: ${picocolors.yellow(MIGRATION)}
      
      Rename ${picocolors.cyan('globals')} to ${picocolors.cyan('initalGlobals')}?
    `;
  },

  async run({ dryRun, result }) {
    result.previewConfig.removeField(['globals']);
    result.previewConfig.setFieldNode(['initialGlobals'], result.globals);
    if (!dryRun) {
      await writeFile(result.previewConfigPath, formatConfig(result.previewConfig));
    }
  },
};

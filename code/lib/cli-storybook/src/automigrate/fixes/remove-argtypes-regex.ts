import { readFile } from 'node:fs/promises';

import { babelParse } from 'storybook/internal/csf-tools';

import * as babel from '@babel/core';
import type { BabelFile, NodePath } from '@babel/core';
import chalk from 'chalk';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

export const removeArgtypesRegex: Fix<{ argTypesRegex: NodePath; previewConfigPath: string }> = {
  id: 'remove-argtypes-regex',
  promptType: 'manual',
  versionRange: ['<8.0.0-alpha.0', '>=8.0.0-alpha.0'],
  async check({ previewConfigPath }) {
    if (!previewConfigPath) {
      return null;
    }

    const previewFile = await readFile(previewConfigPath, { encoding: 'utf-8' });

    // @ts-expect-error File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606
    const file: BabelFile = new babel.File(
      { filename: previewConfigPath },
      { code: previewFile, ast: babelParse(previewFile) }
    );

    let argTypesRegex;

    file.path.traverse({
      Identifier: (path) => {
        if (path.node.name === 'argTypesRegex') {
          argTypesRegex = path;
        }
      },
    });

    return argTypesRegex ? { argTypesRegex, previewConfigPath } : null;
  },
  prompt({ argTypesRegex, previewConfigPath }) {
    return dedent`
      ${chalk.bold('Attention')}: We've detected that you're using argTypesRegex:
      
      ${argTypesRegex.buildCodeFrameError(`${previewConfigPath}`).message}

      Storybook's play functions let you render your stories interactively.
      
      In the past, play functions mocked action args implicitly by analyzing the argTypesRegex
      in your preview.js|ts file.
      
      However, Storybook 8 changes this behavior, and we now recommend using the 
      (fn) function to mock your component's methods instead.
      
      Use the following command to check for implied mocked actions in your play functions:
      ${chalk.cyan(
        'npx storybook migrate find-implicit-spies --glob="**/*.stories.@(js|jsx|ts|tsx)"'
      )}
       
      Then, refer to our docs to migrate your play functions to Storybook 8: 
      ${chalk.yellow(
        'https://storybook.js.org/docs/8.0/essentials/actions#via-storybooktest-fn-spy-function'
      )}
    `;
  },
};

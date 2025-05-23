import { types as t } from 'storybook/internal/babel';
import { detectPnp } from 'storybook/internal/cli';
import { readConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';
import {
  doesVariableOrFunctionDeclarationExist,
  getFieldsForRequireWrapper,
  getRequireWrapperAsCallExpression,
  getRequireWrapperName,
  isRequireWrapperNecessary,
  wrapValueWithRequireWrapper,
} from './wrap-require-utils';

export interface WrapRequireRunOptions {
  storybookVersion: string;
  isStorybookInMonorepo: boolean;
  isPnp: boolean;
  isConfigTypescript: boolean;
}

export const wrapRequire: Fix<WrapRequireRunOptions> = {
  id: 'wrap-require',

  versionRange: ['*', '*'],

  async check({ packageManager, storybookVersion, mainConfigPath }) {
    const isStorybookInMonorepo = await packageManager.isStorybookInMonorepo();
    const isPnp = await detectPnp();

    if (!mainConfigPath) {
      return null;
    }

    const config = await readConfig(mainConfigPath);

    if (!isStorybookInMonorepo && !isPnp) {
      return null;
    }

    if (!getFieldsForRequireWrapper(config).some((node) => isRequireWrapperNecessary(node))) {
      return null;
    }

    const isConfigTypescript = mainConfigPath.endsWith('.ts') || mainConfigPath.endsWith('.tsx');

    return { storybookVersion, isStorybookInMonorepo, isPnp, isConfigTypescript };
  },

  prompt({ storybookVersion, isStorybookInMonorepo }) {
    const sbFormatted = picocolors.cyan(`Storybook ${storybookVersion}`);

    return dedent`We have detected that you're using ${sbFormatted} in a ${
      isStorybookInMonorepo ? 'monorepo' : 'PnP'
    } project. 
    For Storybook to work correctly, some fields in your main config must be updated. We can do this for you automatically.
    
    More info: https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments`;
  },

  async run({ dryRun, mainConfigPath, result }) {
    await updateMainConfig({ dryRun: !!dryRun, mainConfigPath }, (mainConfig) => {
      getFieldsForRequireWrapper(mainConfig).forEach((node) => {
        wrapValueWithRequireWrapper(mainConfig, node);
      });

      if (getRequireWrapperName(mainConfig) === null) {
        if (
          mainConfig?.fileName?.endsWith('.cjs') ||
          mainConfig?.fileName?.endsWith('.cts') ||
          mainConfig?.fileName?.endsWith('.cjsx') ||
          mainConfig?.fileName?.endsWith('.ctsx')
        ) {
          mainConfig.setRequireImport(['dirname', 'join'], 'node:path');
        } else {
          mainConfig.setImport(['dirname', 'join'], 'node:path');
          mainConfig.setImport(['createRequire'], 'node:module');

          // Continue here
          const hasRequire = mainConfig
            .getBodyDeclarations()
            .some((node) => doesVariableOrFunctionDeclarationExist(node, 'require'));

          if (!hasRequire) {
            mainConfig.setBodyDeclaration(
              t.variableDeclaration('const', [
                t.variableDeclarator(
                  t.identifier('require'),
                  t.callExpression(t.identifier('createRequire'), [t.identifier('import.meta.url')])
                ),
              ])
            );
          }
        }
        mainConfig.setBodyDeclaration(getRequireWrapperAsCallExpression(result.isConfigTypescript));
      }
    });
  },
};

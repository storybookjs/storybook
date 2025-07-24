import { types as t } from 'storybook/internal/babel';
import { detectPnp } from 'storybook/internal/cli';
import { readConfig } from 'storybook/internal/csf-tools';

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
  link: 'https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments',

  async check({ packageManager, storybookVersion, mainConfigPath }) {
    const isStorybookInMonorepo = packageManager.isStorybookInMonorepo();
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

  prompt() {
    return dedent`We have detected that you're using Storybook in a monorepo or PnP project. Some fields in your main config must be updated.`;
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
          mainConfig?.fileName?.endsWith('.ctsx') ||
          mainConfig._code.includes('module.exports')
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
            const body = mainConfig._ast.program.body;
            const lastImportIndex = body.findLastIndex((node) => t.isImportDeclaration(node));
            const requireDeclaration = t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('require'),
                t.callExpression(t.identifier('createRequire'), [t.identifier('import.meta.url')])
              ),
            ]);
            body.splice(lastImportIndex + 1, 0, requireDeclaration);
          }
        }
        mainConfig.setBodyDeclaration(getRequireWrapperAsCallExpression(result.isConfigTypescript));
      }
    });
  },
};

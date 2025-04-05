import { types as t } from 'storybook/internal/babel';
import { detectPnp } from 'storybook/internal/cli';
import { readConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';
import {
  getFieldsForRequireWrapper,
  getRequireWrapperAsCallExpression,
  getRequireWrapperName,
  isRequireWrapperNecessary,
  wrapValueWithRequireWrapper,
} from './wrap-require-utils';

interface WrapRequireRunOptions {
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
    return new Promise((resolve, reject) => {
      updateMainConfig({ dryRun: !!dryRun, mainConfigPath }, (mainConfig) => {
        try {
          getFieldsForRequireWrapper(mainConfig).forEach((node) => {
            wrapValueWithRequireWrapper(mainConfig, node);
          });

          if (getRequireWrapperName(mainConfig) === null) {
            // Check for existing path imports
            const existingPathImport = mainConfig
              .getBodyDeclarations()
              .find(
                (node): node is t.ImportDeclaration =>
                  t.isImportDeclaration(node) &&
                  (node.source.value === 'path' || node.source.value === 'node:path')
              );

            const pathSource = existingPathImport?.source.value || 'path';
            const existingSpecifiers = existingPathImport?.specifiers || [];

            // Check if we already have the imports we need
            const hasDirname = existingSpecifiers.some(
              (spec) =>
                t.isImportSpecifier(spec) &&
                t.isIdentifier(spec.imported) &&
                spec.imported.name === 'dirname'
            );
            const hasJoin = existingSpecifiers.some(
              (spec) =>
                t.isImportSpecifier(spec) &&
                t.isIdentifier(spec.imported) &&
                spec.imported.name === 'join'
            );

            const importsToAdd = [];

            if (!hasDirname) {
              importsToAdd.push('dirname');
            }

            if (!hasJoin) {
              importsToAdd.push('join');
            }

            if (importsToAdd.length > 0) {
              if (existingPathImport) {
                importsToAdd.forEach((importName) => {
                  existingPathImport.specifiers.push(
                    t.importSpecifier(t.identifier(importName), t.identifier(importName))
                  );
                });
              } else {
                if (
                  mainConfig?.fileName?.endsWith('.cjs') ||
                  mainConfig?.fileName?.endsWith('.cts') ||
                  mainConfig?.fileName?.endsWith('.cjsx') ||
                  mainConfig?.fileName?.endsWith('.ctsx')
                ) {
                  mainConfig.setRequireImport(importsToAdd, pathSource);
                } else {
                  mainConfig.setImport(importsToAdd, pathSource);
                }
              }
            }

            mainConfig.setBodyDeclaration(
              getRequireWrapperAsCallExpression(result.isConfigTypescript)
            );
          }

          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  },
};

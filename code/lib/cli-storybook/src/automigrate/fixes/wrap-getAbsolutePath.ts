import {
  getAbsolutePathWrapperAsCallExpression,
  getAbsolutePathWrapperName,
  getFieldsForGetAbsolutePathWrapper,
  isGetAbsolutePathWrapperNecessary,
  wrapValueWithGetAbsolutePathWrapper,
} from 'storybook/internal/common';
import { loadConfig } from 'storybook/internal/csf-tools';
import { CommonJsConfigNotSupportedError } from 'storybook/internal/server-errors';

import { dedent } from 'ts-dedent';

import type { Fix } from '../types.ts';

export interface WrapGetAbsolutePathRunOptions {
  storybookVersion: string;
  isStorybookInMonorepo: boolean;
  isConfigTypescript: boolean;
}

export const wrapGetAbsolutePath: Fix<WrapGetAbsolutePathRunOptions> = {
  id: 'wrap-getAbsolutePath',
  link: 'https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments',

  async check({ packageManager, storybookVersion, mainConfigPath, files }) {
    const isStorybookInMonorepo = packageManager.isStorybookInMonorepo();

    if (!mainConfigPath) {
      return null;
    }

    const config = loadConfig(await files.read(mainConfigPath), mainConfigPath).parse();

    if (!isStorybookInMonorepo) {
      return null;
    }

    if (
      !getFieldsForGetAbsolutePathWrapper(config).some((node) =>
        isGetAbsolutePathWrapperNecessary(node)
      )
    ) {
      return null;
    }

    const isConfigTypescript = mainConfigPath.endsWith('.ts') || mainConfigPath.endsWith('.tsx');

    return { storybookVersion, isStorybookInMonorepo, isConfigTypescript };
  },

  prompt() {
    return dedent`We have detected that you're using Storybook in a monorepo. Some fields in your main config must be updated.`;
  },

  async run({ files, mainConfigPath, result }) {
    await files.editConfig(mainConfigPath, (mainConfig) => {
      getFieldsForGetAbsolutePathWrapper(mainConfig).forEach((node) => {
        wrapValueWithGetAbsolutePathWrapper(mainConfig, node);
      });

      if (getAbsolutePathWrapperName(mainConfig) === null) {
        if (
          mainConfig?.fileName?.endsWith('.cjs') ||
          mainConfig?.fileName?.endsWith('.cts') ||
          mainConfig?.fileName?.endsWith('.cjsx') ||
          mainConfig?.fileName?.endsWith('.ctsx') ||
          mainConfig._code.includes('module.exports')
        ) {
          throw new CommonJsConfigNotSupportedError();
        } else {
          mainConfig.setImport(['dirname'], 'node:path');
          mainConfig.setImport(['fileURLToPath'], 'node:url');
        }
        mainConfig.setBodyDeclaration(
          getAbsolutePathWrapperAsCallExpression(result.isConfigTypescript)
        );
      }
    });
  },
};

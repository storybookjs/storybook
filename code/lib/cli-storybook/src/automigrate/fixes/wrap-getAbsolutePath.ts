import {
  getAbsolutePathWrapperAsCallExpression,
  getAbsolutePathWrapperName,
  getFieldsForGetAbsolutePathWrapper,
  isGetAbsolutePathWrapperNecessary,
  wrapValueWithGetAbsolutePathWrapper,
} from 'storybook/internal/common';
import { CommonJsConfigNotSupportedError } from 'storybook/internal/server-errors';

import { dedent } from 'ts-dedent';

import type { Fix } from '../types.ts';

export const wrapGetAbsolutePath: Fix = {
  id: 'wrap-getAbsolutePath',
  link: 'https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments',

  async check({ packageManager }) {
    return packageManager.isStorybookInMonorepo() ? {} : null;
  },

  prompt() {
    return dedent`We have detected that you're using Storybook in a monorepo. Some fields in your main config must be updated.`;
  },

  transform: () => [
    {
      filter: { kind: ['main'] },
      editConfig: (mainConfig, { id }) => {
        const fields = getFieldsForGetAbsolutePathWrapper(mainConfig);
        if (!fields.some((node) => isGetAbsolutePathWrapperNecessary(node))) {
          return;
        }
        fields.forEach((node) => wrapValueWithGetAbsolutePathWrapper(mainConfig, node));

        if (getAbsolutePathWrapperName(mainConfig) === null) {
          if (/\.c[jt]sx?$/.test(id) || mainConfig._code.includes('module.exports')) {
            throw new CommonJsConfigNotSupportedError();
          }
          mainConfig.setImport(['dirname'], 'node:path');
          mainConfig.setImport(['fileURLToPath'], 'node:url');
          mainConfig.setBodyDeclaration(getAbsolutePathWrapperAsCallExpression(/\.tsx?$/.test(id)));
        }
      },
    },
  ],
};

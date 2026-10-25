/*
This script updates `lib/configs/flat/*.js` files from rule's meta data.
*/
import fs from 'node:fs/promises';

import { format } from 'oxfmt';
import { join, resolve } from 'pathe';
import type { TCategory } from './utils/categories.ts';
import { categories } from './utils/categories.ts';
import {
  MAIN_JS_FILE,
  STORIES_GLOBS,
  extendsCategories,
  formatRules,
  formatSingleRule,
} from './utils/updates.ts';

function formatCategory(category: TCategory) {
  const extendsCategoryId = extendsCategories[category.categoryId];
  if (extendsCategoryId == null) {
    return `
      import type { TSESLint } from '@typescript-eslint/utils';

      import storybookPlugin from '../../index.ts';

      /*
      * IMPORTANT!
      * This file has been automatically generated,
      * in order to update its content, execute "yarn update-rules" or rebuild this package.
      */
      const config: TSESLint.FlatConfig.ConfigArray = [
        {
          name: 'storybook:${category.categoryId}:setup',
          plugins: {
            get storybook() {
              // this getter could just be a direct import, but we need to use a getter to avoid circular references in the types
              return storybookPlugin;
            },
          }
        },
        {
          name: 'storybook:${category.categoryId}:stories-rules',
          files: [${STORIES_GLOBS.join(', ')}],
          rules: ${formatRules(category.rules, ['storybook/no-uninstalled-addons'])}
        },
        {
          name: 'storybook:${category.categoryId}:main-rules',
          files: [${MAIN_JS_FILE.join(', ')}],
          rules: ${formatSingleRule(category.rules, 'storybook/no-uninstalled-addons')}
        }
      ] satisfies TSESLint.FlatConfig.ConfigArray;

      export default config;
    `;
  }
  return `import type { TSESLint } from '@typescript-eslint/utils';

    /*
    * IMPORTANT!
    * This file has been automatically generated,
    * in order to update its content, execute "yarn update-rules" or rebuild this package.
    */
    import baseConfig from './${extendsCategoryId}.ts';

    const config: TSESLint.FlatConfig.ConfigArray = [
      ...baseConfig,
      {
        name: 'storybook:${category.categoryId}:rules',
        files: [${STORIES_GLOBS.join(', ')}],
        rules: ${formatRules(category.rules)}
      }
    ] satisfies TSESLint.FlatConfig.ConfigArray;

    export default config;
  `;
}

const FLAT_CONFIG_DIR = resolve(import.meta.dirname, '../src/configs/flat');

export async function update() {
  // setup config directory
  await fs.mkdir(FLAT_CONFIG_DIR, { recursive: true }).catch(() => {});

  // Update/add rule files
  await Promise.all(
    categories.map(async (category) => {
      const filePath = join(FLAT_CONFIG_DIR, `${category.categoryId}.ts`);
      const { code: content } = await format(
        `${category.categoryId}.ts`,
        formatCategory(category),
        { singleQuote: true }
      );

      await fs.writeFile(filePath, content);
    })
  );
}

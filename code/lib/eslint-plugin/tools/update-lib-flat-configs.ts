/*
This script updates `lib/configs/flat/*.js` files from rule's meta data.
*/
import fs from 'fs/promises';
import path from 'path';
import type { Options } from 'prettier';
import { format } from 'prettier';

import prettierConfig from '../.prettierrc.js';
import type { TCategory } from './utils/categories';
import { categories } from './utils/categories';
import {
  MAIN_JS_FILE,
  STORIES_GLOBS,
  extendsCategories,
  formatRules,
  formatSingleRule,
} from './utils/updates';

function formatCategory(category: TCategory) {
  const extendsCategoryId = extendsCategories[category.categoryId];
  if (extendsCategoryId == null) {
    return `/*
      * IMPORTANT!
      * This file has been automatically generated,
      * in order to update its content, execute "yarn update-all"
      */
      export = [
        {
          name: 'storybook:${category.categoryId}:setup',
          plugins: {
            get storybook() {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              return require('../../index')
            }
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
      ]
    `;
  }
  return `/*
    * IMPORTANT!
    * This file has been automatically generated,
    * in order to update its content, execute "yarn update-all"
    */
    import config from './${extendsCategoryId}'

    export = [
      ...config,
      {
        name: 'storybook:${category.categoryId}:rules',
        rules: ${formatRules(category.rules)}
      }
    ]
  `;
}

const FLAT_CONFIG_DIR = path.resolve(__dirname, '../lib/configs/flat');

export async function update() {
  // setup config directory
  await fs.mkdir(FLAT_CONFIG_DIR);

  // Update/add rule files
  await Promise.all(
    categories.map(async (category) => {
      const filePath = path.join(FLAT_CONFIG_DIR, `${category.categoryId}.ts`);
      const content = await format(formatCategory(category), {
        parser: 'typescript',
        ...(prettierConfig as Options),
      });

      await fs.writeFile(filePath, content);
    })
  );
}

/*
This script updates `lib/configs/*.js` files from rule's meta data.
*/
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Options } from 'prettier';
import { format } from 'prettier';

// @ts-expect-error this file has no types
import prettierConfig from '../../../prettier.config.js';
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
      * in order to update its content, execute "yarn update-rules" or rebuild this package.
      */
      export default {
        plugins: [
          'storybook'
        ],
        overrides: [{
          files: [${STORIES_GLOBS.join(', ')}],
          rules: ${formatRules(category.rules, ['storybook/no-uninstalled-addons'])}
        }, {
          files: [${MAIN_JS_FILE.join(', ')}],
          rules: ${formatSingleRule(category.rules, 'storybook/no-uninstalled-addons')}
        }]
      }
    `;
  }
  return `/*
    * IMPORTANT!
    * This file has been automatically generated,
    * in order to update its content, execute "yarn update-rules" or rebuild this package.
    */
    export default {
      // This file is bundled in an index.js file at the root
      // so the reference is relative to the src directory
      extends: './configs/${extendsCategoryId}',
      overrides: [{
        files: [${STORIES_GLOBS.join(', ')}],
        rules: ${formatRules(category.rules)}
      },]
    }
  `;
}

const CONFIG_DIR = path.resolve(__dirname, '../src/configs/');

export async function update() {
  // setup config directory
  await fs.mkdir(CONFIG_DIR);

  // Update/add rule files
  await Promise.all(
    categories.map(async (category) => {
      const filePath = path.join(CONFIG_DIR, `${category.categoryId}.ts`);
      const content = await format(formatCategory(category), {
        parser: 'typescript',
        ...(prettierConfig as Options),
      });

      await fs.writeFile(filePath, content);
    })
  );
}

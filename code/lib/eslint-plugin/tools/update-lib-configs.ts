/*
This script updates `lib/configs/*.js` files from rule's meta data.
*/

import fs from 'fs/promises'
import path from 'path'
import { format, Options } from 'prettier'
import prettierConfig from '../.prettierrc'
import { categories, TCategory } from './utils/categories'
import {
  extendsCategories,
  STORIES_GLOBS,
  MAIN_JS_FILE,
  formatRules,
  formatSingleRule,
} from './utils/updates'

function formatCategory(category: TCategory) {
  const extendsCategoryId = extendsCategories[category.categoryId]
  if (extendsCategoryId == null) {
    return `/*
      * IMPORTANT!
      * This file has been automatically generated,
      * in order to update its content, execute "pnpm run update-all"
      */
      export = {
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
    `
  }
  return `/*
    * IMPORTANT!
    * This file has been automatically generated,
    * in order to update its content, execute "pnpm run update-all"
    */
    export = {
      extends: require.resolve('eslint-plugin-storybook/dist/configs/${extendsCategoryId}'),
      rules: ${formatRules(category.rules)}
    }
  `
}

const CONFIG_DIR = path.resolve(__dirname, '../lib/configs/')

export async function update() {
  // setup config directory
  await fs.mkdir(CONFIG_DIR)

  // Update/add rule files
  await Promise.all(
    categories.map(async (category) => {
      const filePath = path.join(CONFIG_DIR, `${category.categoryId}.ts`)
      const content = await format(formatCategory(category), {
        parser: 'typescript',
        ...(prettierConfig as Options),
      })

      await fs.writeFile(filePath, content)
    })
  )
}

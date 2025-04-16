'use strict';

/*
This script updates `lib/index.js` file from rule's meta data.
*/
import fs from 'fs/promises';
import path from 'path';
import type { Options } from 'prettier';
import { format } from 'prettier';

import prettierConfig from '../.prettierrc.js';
import { categoryIds } from './utils/categories';
import rules from './utils/rules';

function camelize(text: string) {
  const a = text.toLowerCase().replace(/[-_\s.]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  return a.substring(0, 1).toLowerCase() + a.substring(1);
}

export async function update() {
  const rawContent = `/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content execute "yarn update"
 */
// configs
${categoryIds
  .map((categoryId) => `import ${camelize(categoryId)} from './configs/${categoryId}'`)
  .join('\n')}
${categoryIds
  .map(
    (categoryId) => `import ${camelize(`flat-${categoryId}`)} from './configs/flat/${categoryId}'`
  )
  .join('\n')}

// rules
${rules.map((rule) => `import ${camelize(rule.name)} from './rules/${rule.name}'`).join('\n')}

// export plugin
export = {
  configs: {
    // eslintrc configs
    ${categoryIds.map((categoryId) => `'${categoryId}': ${camelize(categoryId)}`).join(',\n')},

    // flat configs
    ${categoryIds
      .map((categoryId) => `'flat/${categoryId}': ${camelize(`flat-${categoryId}`)}`)
      .join(',\n')},
  },
  rules: {
    ${rules.map((rule) => `'${rule.name}': ${camelize(rule.name)}`).join(',\n')}
  }
}
`;
  const content = await format(rawContent, {
    parser: 'typescript',
    ...(prettierConfig as Options),
  });
  await fs.writeFile(path.resolve(__dirname, '../lib/index.ts'), content);
}

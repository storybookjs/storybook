import fs from 'fs';
import path from 'path';

import type { StorybookRuleMeta } from '../../src/types';
import type { createStorybookRule } from '../../src/utils/create-storybook-rule';

const ROOT = path.resolve(__dirname, '../../src/rules');

export type TRule = ReturnType<typeof createStorybookRule> & {
  meta: StorybookRuleMeta;
};

const rules = fs
  .readdirSync(ROOT)
  .filter((file) => path.extname(file) === '.ts' && !file.endsWith('.test.ts'))
  .map((file) => path.basename(file, '.ts'))
  .map((name) => {
    const rule = require(path.join(ROOT, name)) as TRule;
    const meta: StorybookRuleMeta = { ...rule.meta };
    if (meta.docs && !meta.docs.categories) {
      meta.docs = { ...meta.docs };
      meta.docs.categories = [];
    }

    return {
      ruleId: `storybook/${name}`,
      name,
      meta,
    };
  });

export type TRules = typeof rules;

export default rules;

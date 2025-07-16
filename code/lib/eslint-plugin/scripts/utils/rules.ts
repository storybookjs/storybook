import fs from 'node:fs';
import path from 'node:path';

import type { StorybookRuleMeta } from '../../src/types';
import type { createStorybookRule } from '../../src/utils/create-storybook-rule';

const ROOT = path.resolve(import.meta.dirname, '../../src/rules');

export type TRule = ReturnType<typeof createStorybookRule> & {
  meta: StorybookRuleMeta;
};

export default async function getRules() {
  const files = await fs.promises.readdir(ROOT);
  const ruleFiles = files
    .filter((file) => path.extname(file) === '.ts' && !file.endsWith('.test.ts'))
    .map((file) => path.basename(file, '.ts'));

  const rules = await Promise.all(
    ruleFiles.map(async (name) => {
      const ruleModule = await import(path.join(ROOT, name));
      // Support both default and named export
      const rule = (ruleModule.default ?? ruleModule) as TRule;
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
    })
  );
  return rules;
}

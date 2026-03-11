import type { CategoryId } from '../../src/utils/constants';
import type { TCategory } from './categories';

export const extendsCategories: Partial<Record<CategoryId, string | null>> = {
  csf: null,
  recommended: null,
  'csf-strict': 'csf',
};

const externalRuleOverrides: { [key: string]: string } = {
  'react-hooks/rules-of-hooks': 'off',
  'import-x/no-anonymous-default-export': 'off',
};

export function formatRules(rules: TCategory['rules'], exclude?: string[]) {
  const obj = rules.reduce(
    (setting, rule) => {
      if (!exclude?.includes(rule.ruleId)) {
        setting[rule.ruleId] = rule.meta.severity || 'error';
      }
      return setting;
    },
    { ...externalRuleOverrides }
  );

  return JSON.stringify(obj, null, 2) + ' as const';
}

export function formatSingleRule(rules: TCategory['rules'], ruleId: string) {
  const ruleOpt = rules.find((rule) => rule.ruleId === ruleId)?.meta.severity || 'error';

  return JSON.stringify({ [ruleId]: ruleOpt }, null, 2) + ' as const';
}

export const SUPPORTED_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];
export const STORIES_GLOBS = [
  `'**/*.stories.@(${SUPPORTED_EXTENSIONS.join('|')})'`,
  `'**/*.story.@(${SUPPORTED_EXTENSIONS.join('|')})'`,
];

// Other files that will be linted
export const MAIN_JS_FILE = [`'.storybook/main.@(js|cjs|mjs|ts)'`];

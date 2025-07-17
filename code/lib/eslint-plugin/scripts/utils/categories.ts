import { CategoryId } from '../../src/utils/constants';
import type { TRules } from './rules';
import rules from './rules';

type TCategoriesConfig = Record<string, { text: string; rules: TRules }>;

const categoriesConfig: TCategoriesConfig = {
  [CategoryId.CSF]: {
    text: 'CSF Rules',
    rules: [],
  },
  [CategoryId.CSF_STRICT]: {
    text: 'Strict CSF Rules',
    rules: [],
  },
  [CategoryId.ADDON_INTERACTIONS]: {
    text: 'Rules for writing interactions in Storybook',
    rules: [],
  },
  [CategoryId.RECOMMENDED]: {
    text: 'Base rules recommended by Storybook',
    rules: [],
  },
};

export const categoryIds = Object.keys(categoriesConfig) as CategoryId[];

for (const categoryId of categoryIds) {
  const category = categoriesConfig[categoryId] as (typeof categoriesConfig)[CategoryId];
  category.rules = [];

  for (const rule of rules) {
    const ruleCategories = rule.meta.docs?.categories;

    if (
      categoriesConfig[categoryId] &&
      ruleCategories?.includes(categoryId) &&
      rule.meta.docs?.excludeFromConfig !== true
    ) {
      categoriesConfig[categoryId].rules?.push(rule);
    }
  }
}

export const categories = categoryIds
  .map((categoryId) => {
    const category = categoriesConfig[categoryId] as (typeof categoriesConfig)[CategoryId];
    if (!category.rules.length) {
      throw new Error(
        `Category "${categoryId}" has no rules. Make sure that at least one rule is linked to this category.`
      );
    }

    return {
      categoryId,
      title: category,
      rules: category.rules.filter((rule) => !rule.meta.deprecated),
    };
  })
  .filter((category) => category.rules.length >= 1);

export type TCategory = typeof categories extends (infer TCat)[] ? TCat : never;

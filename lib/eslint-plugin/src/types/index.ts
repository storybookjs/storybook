import type { TSESLint } from '@typescript-eslint/utils';

import type { CategoryId } from '../utils/constants';

export type RuleModule = TSESLint.RuleModule<'', []> & {
  meta: { hasSuggestions?: boolean };
};

// These 2 types are copied from @typescript-eslint/experimental-utils' CreateRuleMeta
// and modified to our needs
export type StorybookRuleMetaDocs = TSESLint.RuleMetaDataDocs & {
  /** Whether or not this rule should be excluded from linter config */
  excludeFromConfig?: boolean;
  /** Which configs the rule should be part of */
  categories?: CategoryId[];
};

export type StorybookRuleMeta<TMessageIds extends string = ''> = TSESLint.RuleMetaData<
  TMessageIds,
  StorybookRuleMetaDocs
> & {
  /** Severity of the rule to be defined in eslint config */
  severity: 'off' | 'warn' | 'error';
};

// Comment out for testing purposes:
// const docs: StorybookRuleMetaDocs = {
//   description: 'bla',
// }

// const meta: StorybookRuleMeta<'someId'> = {
//   messages: {
//     someId: 'yea',
//   },
//   type: 'problem',
//   schema: [],
//   docs,
//   severity: 'error',
// }

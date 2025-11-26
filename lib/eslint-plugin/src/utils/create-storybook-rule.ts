import type { TSESLint } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

import type { StorybookRuleMeta } from '../types';
import { docsUrl } from './index';

export function createStorybookRule<
  TOptions extends readonly unknown[],
  TMessageIds extends string,
  TRuleListener extends TSESLint.RuleListener = TSESLint.RuleListener,
>({
  create,
  meta,
  ...remainingConfig
}: Readonly<{
  name: string;
  meta: StorybookRuleMeta<TMessageIds>;
  defaultOptions: TOptions;
  create: (
    context: Readonly<TSESLint.RuleContext<TMessageIds, TOptions>>,
    optionsWithDefault: Readonly<TOptions>
  ) => TRuleListener;
}>) {
  const ruleCreator = ESLintUtils.RuleCreator(docsUrl);
  return ruleCreator({
    ...remainingConfig,
    create,
    meta: {
      ...meta,
      docs: {
        ...meta.docs!,
      },
      defaultOptions: remainingConfig.defaultOptions,
    },
  });
}

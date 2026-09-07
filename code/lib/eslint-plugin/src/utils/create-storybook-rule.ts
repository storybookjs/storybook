import type { TSESLint } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

import type { StorybookRuleMeta } from '../types/index.ts';
import { docsUrl } from './index.ts';

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
  const ruleCreator = RuleCreator(docsUrl);
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

import type { TSESLint } from '@typescript-eslint/utils';

import type { StorybookRule, StorybookRuleMeta } from '../types/index.ts';
import { docsUrl } from './index.ts';

export function createStorybookRule<
  TOptions extends readonly unknown[],
  TMessageIds extends string,
  TRuleListener extends TSESLint.RuleListener = TSESLint.RuleListener,
>({
  create,
  meta,
  name,
  defaultOptions,
}: Readonly<{
  name: string;
  meta: StorybookRuleMeta<TMessageIds>;
  defaultOptions: TOptions;
  create: (
    context: Readonly<TSESLint.RuleContext<TMessageIds, TOptions>>,
    optionsWithDefault: Readonly<TOptions>
  ) => TRuleListener;
}>): StorybookRule<TMessageIds, TOptions> {
  return {
    name,
    meta: {
      ...meta,
      docs: {
        ...meta.docs!,
        url: docsUrl(name),
      },
      defaultOptions,
    },
    defaultOptions,
    create(context: Readonly<TSESLint.RuleContext<TMessageIds, TOptions>>) {
      const options = defaultOptions.map(
        (option, index) => context.options[index] ?? option
      ) as unknown as TOptions;
      return create(context, options);
    },
  };
}

import type { Args as BaseArgs } from 'storybook/internal/types';
import dedent from 'dedent';
import type { EmptyObject } from 'type-fest';

import type {
  Meta as MetaType,
  StoryCmp,
  StoryContext as BaseStoryContext,
  StoryAnnotations,
  Cmp,
} from '#types';

import StoryComponent from './runtime/Story.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<
  const TOverrideArgs extends BaseArgs = EmptyObject,
  const TCmp extends Cmp = Cmp,
>(meta: MetaType<TCmp>) {
  return {
    Story: StoryComponent as StoryCmp<EmptyObject, TCmp, typeof meta>,
    meta,
  };
}

export type Args<TStoryCmp> =
  TStoryCmp extends StoryCmp<infer _TOverrideArgs, infer TCmpOrArgs, infer TMeta>
    ? NonNullable<StoryAnnotations<TCmpOrArgs, TMeta>['args']>
    : never;

export type StoryContext<TStoryCmp> =
  TStoryCmp extends StoryCmp<infer _TOverrideArgs, infer TCmpOrArgs, infer TMeta>
    ? BaseStoryContext<TCmpOrArgs, TMeta>
    : never;

/**
 * @deprecated Use `defineMeta` instead
 * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#meta-component-removed-in-favor-of-definemeta}
 */
export const Meta = () => {
  throw new Error(dedent`
    The Meta component has been removed in favor of the defineMeta function.
    For more details, see: @link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#meta-component-removed-in-favor-of-definemeta
  `);
};

/**
 * @deprecated Use `Story` component returned from `defineMeta` instead
 * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#export-meta-removed-in-favor-of-definemeta}
 */
export const Story = () => {
  throw new Error(dedent`
    The Story component can not be imported anymore, but must be desctructured from the defineMeta() call.
    For more details, see: https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#export-meta-removed-in-favor-of-definemeta
  `);
};

/**
 * @deprecated Use snippets instead
 * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed}
 */
export const Template = () => {
  throw new Error(dedent`
    The Template component has been removed in favor of the snippets syntax.
    see: https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed
  `);
};

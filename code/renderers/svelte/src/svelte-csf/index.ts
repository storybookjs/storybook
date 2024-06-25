import type { Args as BaseArgs } from '@storybook/types';
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
 * @see TODO link to MIGRATION.md
 */
export const Meta = () => {
  throw new Error(`The Meta component has been removed in favor of the defineMeta function.
    See TODO link to MIGRATION.md for more details.`);
};

/**
 * @deprecated Use `Story` component returned from `defineMeta` instead
 * @see TODO link to MIGRATION.md
 */
export const Story = () => {
  throw new Error(`The Story component can not be imported anymore, but must be desctructured from the defineMeta() call.
    See TODO link to MIGRATION.md for more details.`);
};

/**
 * @deprecated Use snippets instead
 * @see TODO link to MIGRATION.md
 */
export const Template = () => {
  throw new Error(`The Template component has been removed in favor of the snippets syntax.
    See TODO link to MIGRATION.md for more details.`);
};

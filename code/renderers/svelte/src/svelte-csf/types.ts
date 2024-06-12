import type {
  Args as BaseArgs,
  Meta as BaseMeta,
  StoryContext as BaseStoryContext,
} from '@storybook/svelte';
import type { ComponentType, Snippet, SvelteComponent } from 'svelte';
import type { Primitive } from 'type-fest';

import Story from './runtime/Story.svelte';

type SnippetsToPrimitives<Props extends Record<string, unknown>> = {
  [ArgKey in keyof Props]?: Props[ArgKey] extends Snippet ? Snippet | Primitive : Props[ArgKey];
};

export type Meta<CmpOrArgs = BaseArgs> =
  CmpOrArgs extends SvelteComponent<infer Props extends Record<string, unknown>>
    ? BaseMeta<SvelteComponent<SnippetsToPrimitives<Props>>>
    : BaseMeta<CmpOrArgs>;

export type Args<TStory extends ComponentType = ComponentType> =
  TStory extends ComponentType<Story<infer TOverrideArgs, infer TMeta extends Meta>>
    ? TMeta['args']
    : never;

export type StoryContext<TStory extends ComponentType = ComponentType> = BaseStoryContext<
  Args<TStory>
>;

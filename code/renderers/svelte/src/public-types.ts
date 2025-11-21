import type {
  AnnotatedStoryFn,
  Args,
  ArgsFromMeta,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  StoryContext as GenericStoryContext,
  LoaderFunction,
  ProjectAnnotations,
  StoryAnnotations,
  StrictArgs,
} from 'storybook/internal/types';

import type { Component, ComponentProps } from 'svelte';
import type { SetOptional, Simplify } from 'type-fest';

import type { SvelteRenderer } from './types';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/api/csf/#default-export)
 */
export type Meta<CmpOrArgs = Args> =
  CmpOrArgs extends Component<infer Props>
    ? ComponentAnnotations<SvelteRenderer<CmpOrArgs>, Props>
    : ComponentAnnotations<SvelteRenderer, CmpOrArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf/#named-story-exports)
 */
export type StoryFn<TCmpOrArgs = Args> =
  TCmpOrArgs extends Component<infer Props>
    ? AnnotatedStoryFn<SvelteRenderer, Props>
    : AnnotatedStoryFn<SvelteRenderer, TCmpOrArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf/#named-story-exports)
 */
export type StoryObj<MetaOrCmpOrArgs = Args> = MetaOrCmpOrArgs extends {
  render?: ArgsStoryFn<SvelteRenderer, any>;
  component: infer Comp; // We cannot use "extends Component" here, because TypeScript for some reason then refuses to ever enter the true branch
  args?: infer DefaultArgs;
}
  ? Simplify<
      ComponentProps<Comp extends Component<any, any, any> ? Comp : never> &
        ArgsFromMeta<SvelteRenderer, MetaOrCmpOrArgs>
    > extends infer TArgs
    ? StoryAnnotations<
        SvelteRenderer<Comp extends Component<any, any, any> ? Comp : never>,
        TArgs,
        SetOptional<TArgs, Extract<keyof TArgs, keyof DefaultArgs>>
      >
    : never
  : MetaOrCmpOrArgs extends Component<any, any, any>
    ? StoryAnnotations<SvelteRenderer<MetaOrCmpOrArgs>, ComponentProps<MetaOrCmpOrArgs>>
    : StoryAnnotations<SvelteRenderer, MetaOrCmpOrArgs>;

export type { SvelteRenderer };
export type Decorator<TArgs = StrictArgs> = DecoratorFunction<SvelteRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<SvelteRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<SvelteRenderer, TArgs>;
export type Preview = ProjectAnnotations<SvelteRenderer>;

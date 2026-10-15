import type {
  AnnotatedStoryFn,
  Args as BaseArgs,
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

import type { SvelteRenderer, SvelteTypes } from './types.ts';
import type { StoryComponent } from './svelte-csf/types.ts';
import type { SvelteCsfStoryProps } from './preview.ts';

export type { ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';

/**
 * Without a type argument, the args of a story: a record of arg names to values.
 *
 * With the `Story` component from `defineMeta` or `preview.meta`, the args of that story.
 *
 * @example
 * ```svelte
 * {#snippet template(args: Args<typeof Story>)}
 *   <!--             👆 first parameter ->
 * {/snippet}
 * ```
 */
export type Args<TStoryCmp = never> = [TStoryCmp] extends [never]
  ? BaseArgs
  : // The component type is `any`: `Component` props are contravariant, so matching on `Cmp` infers nothing
    TStoryCmp extends StoryComponent<infer TArgs extends Record<string, any>, any>
    ? TArgs
    : TStoryCmp extends Component<SvelteCsfStoryProps<infer T extends SvelteTypes, any>>
      ? T['args']
      : never;

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/api/csf#default-export)
 */
export type Meta<CmpOrArgs = BaseArgs> =
  CmpOrArgs extends Component<infer Props>
    ? ComponentAnnotations<SvelteRenderer<CmpOrArgs>, Props>
    : ComponentAnnotations<SvelteRenderer, CmpOrArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryFn<TCmpOrArgs = BaseArgs> =
  TCmpOrArgs extends Component<infer Props>
    ? AnnotatedStoryFn<SvelteRenderer, Props>
    : AnnotatedStoryFn<SvelteRenderer, TCmpOrArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryObj<MetaOrCmpOrArgs = BaseArgs> = MetaOrCmpOrArgs extends {
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

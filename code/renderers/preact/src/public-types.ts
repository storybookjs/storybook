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

import type { ComponentProps, ComponentType } from 'preact';
import type { SetOptional, Simplify } from 'type-fest';

import type { PreactRenderer } from './types';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { PreactRenderer };

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/api/csf#default-export)
 */
export type Meta<TCmpOrArgs = Args> = [TCmpOrArgs] extends [ComponentType<any>]
  ? ComponentAnnotations<PreactRenderer, ComponentProps<TCmpOrArgs>>
  : ComponentAnnotations<PreactRenderer, TCmpOrArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryFn<TCmpOrArgs = Args> = [TCmpOrArgs] extends [ComponentType<any>]
  ? AnnotatedStoryFn<PreactRenderer, ComponentProps<TCmpOrArgs>>
  : AnnotatedStoryFn<PreactRenderer, TCmpOrArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryObj<TMetaOrCmpOrArgs = Args> = [TMetaOrCmpOrArgs] extends [
  {
    render?: ArgsStoryFn<PreactRenderer, any>;
    component?: infer Component;
    args?: infer DefaultArgs;
  },
]
  ? Simplify<
      (Component extends ComponentType<any> ? ComponentProps<Component> : unknown) &
        ArgsFromMeta<PreactRenderer, TMetaOrCmpOrArgs>
    > extends infer TArgs
    ? StoryAnnotations<PreactRenderer, TArgs, SetOptional<TArgs, keyof TArgs & keyof DefaultArgs>>
    : never
  : TMetaOrCmpOrArgs extends ComponentType<any>
    ? StoryAnnotations<PreactRenderer, ComponentProps<TMetaOrCmpOrArgs>>
    : StoryAnnotations<PreactRenderer, TMetaOrCmpOrArgs>;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<PreactRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<PreactRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<PreactRenderer, TArgs>;
export type Preview = ProjectAnnotations<PreactRenderer>;

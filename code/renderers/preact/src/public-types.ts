import type {
  AnnotatedStoryFn,
  Args,
  ArgsFromMeta,
  ArgsStoryFn,
  ComponentAnnotations,
  StoryAnnotations,
  DecoratorFunction,
  LoaderFunction,
  StoryContext as GenericStoryContext,
  StrictArgs,
  ProjectAnnotations,
} from 'storybook/internal/types';
import type { ComponentProps, ComponentType } from 'preact'
import type { SetOptional, Simplify } from 'type-fest';
import type { PreactRenderer } from './types';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { PreactRenderer };

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TCmpOrArgs = Args> = [TCmpOrArgs] extends [ComponentType<any>]
  ? ComponentAnnotations<PreactRenderer, ComponentProps<TCmpOrArgs>>
  : ComponentAnnotations<PreactRenderer, TCmpOrArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryFn<TCmpOrArgs = Args> = [TCmpOrArgs] extends [ComponentType<any>]
  ? AnnotatedStoryFn<PreactRenderer, ComponentProps<TCmpOrArgs>>
  : AnnotatedStoryFn<PreactRenderer, TCmpOrArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
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
    ? StoryAnnotations<
        PreactRenderer,
        AddMocks<TArgs, DefaultArgs>,
        SetOptional<TArgs, keyof TArgs & keyof DefaultArgs>
      >
    : never
  : TMetaOrCmpOrArgs extends ComponentType<any>
    ? StoryAnnotations<PreactRenderer, ComponentProps<TMetaOrCmpOrArgs>>
    : StoryAnnotations<PreactRenderer, TMetaOrCmpOrArgs>;

// This performs a downcast to function types that are mocks, when a mock fn is given to meta args.
type AddMocks<TArgs, DefaultArgs> = Simplify<{
  [T in keyof TArgs]: T extends keyof DefaultArgs
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      DefaultArgs[T] extends (...args: any) => any & { mock: {} } // allow any function with a mock object
      ? DefaultArgs[T]
      : TArgs[T]
    : TArgs[T];
}>;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<PreactRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<PreactRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<PreactRenderer, TArgs>;
export type Preview = ProjectAnnotations<PreactRenderer>;

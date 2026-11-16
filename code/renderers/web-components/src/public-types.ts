import type {
  AnnotatedStoryFn,
  Args,
  ComponentAnnotations,
  DecoratorFunction,
  StoryContext as GenericStoryContext,
  LoaderFunction,
  ProjectAnnotations,
  StoryAnnotations,
  StrictArgs,
} from 'storybook/internal/types';

import type { WebComponentsRenderer } from './types.ts';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { WebComponentsRenderer };

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Meta](https://storybook.js.org/docs/writing-stories/csf#meta)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<WebComponentsRenderer, TArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Stories](https://storybook.js.org/docs/writing-stories/csf#stories)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<WebComponentsRenderer, TArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Stories](https://storybook.js.org/docs/writing-stories/csf#stories)
 */
export type StoryObj<TArgs = Args> = StoryAnnotations<WebComponentsRenderer, TArgs>;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<WebComponentsRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<WebComponentsRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<WebComponentsRenderer, TArgs>;
export type Preview = ProjectAnnotations<WebComponentsRenderer>;

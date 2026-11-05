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

import type { ServerRenderer } from './types.ts';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Meta](https://storybook.js.org/docs/writing-stories/csf#meta)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<ServerRenderer, TArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Stories](https://storybook.js.org/docs/writing-stories/csf#stories)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<ServerRenderer, TArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Stories](https://storybook.js.org/docs/writing-stories/csf#stories)
 */
export type StoryObj<TArgs = Args> = StoryAnnotations<ServerRenderer, TArgs>;

export type { ServerRenderer };
export type Decorator<TArgs = StrictArgs> = DecoratorFunction<ServerRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<ServerRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<ServerRenderer, TArgs>;
export type Preview = ProjectAnnotations<ServerRenderer>;

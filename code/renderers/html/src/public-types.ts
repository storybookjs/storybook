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

import type { HtmlRenderer } from './types.ts';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { HtmlRenderer };

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Meta](https://storybook.js.org/docs/writing-stories/csf#meta)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<HtmlRenderer, TArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Stories](https://storybook.js.org/docs/writing-stories/csf#stories)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<HtmlRenderer, TArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Stories](https://storybook.js.org/docs/writing-stories/csf#stories)
 */
export type StoryObj<TArgs = Args> = StoryAnnotations<HtmlRenderer, TArgs>;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<HtmlRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<HtmlRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<HtmlRenderer, TArgs>;
export type Preview = ProjectAnnotations<HtmlRenderer>;

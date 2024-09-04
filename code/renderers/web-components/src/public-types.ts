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

import type { WebComponentsRenderer } from './types';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { WebComponentsRenderer };

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<WebComponentsRenderer, TArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<WebComponentsRenderer, TArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryObj<TArgs = Args> = StoryAnnotations<WebComponentsRenderer, TArgs>;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<WebComponentsRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<WebComponentsRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<WebComponentsRenderer, TArgs>;
export type Preview = ProjectAnnotations<WebComponentsRenderer>;

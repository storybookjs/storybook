import type {
  Args,
  ComponentAnnotations,
  StrictArgs,
  StoryContext as GenericStoryContext,
  WebRenderer,
} from '@storybook/types';
import type { Component, ComponentProps, Snippet, SvelteComponent } from 'svelte';
import type { EmptyObject, Primitive } from 'type-fest';

import type Story from './runtime/Story.svelte';

// TODO: Use it, as soon as the other types start to works correctly
type MapSnippetsToAcceptPrimitives<Props extends ComponentProps<Component>> = {
  [ArgKey in keyof Props]: Props[ArgKey] extends Snippet ? Snippet | Primitive : Props[ArgKey];
};

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TCmp = any> = TCmp extends
  | Component
  | SvelteComponent
  | __sveltets_2_IsomorphicComponent
  ? ComponentAnnotations<SvelteRenderer<TCmp>, ComponentProps<TCmp>>
  : TCmp extends Args
    ? ComponentAnnotations<SvelteRenderer<TCmp>, TCmp>
    : never;

export interface SvelteRenderer<TCmp = any> extends WebRenderer {
  component: TCmp extends Component | SvelteComponent | __sveltets_2_IsomorphicComponent
    ? TCmp | Component | SvelteComponent | __sveltets_2_IsomorphicComponent
    : TCmp extends Args
      ? Component<TCmp> | SvelteComponent<TCmp> | __sveltets_2_IsomorphicComponent<TCmp>
      : never;
  storyResult: SvelteStoryResult<TCmp>;
}

export interface SvelteStoryResult<TCmp = any> {
  Component: TCmp;
  props: TCmp extends Component | SvelteComponent | __sveltets_2_IsomorphicComponent
    ? ComponentProps<TCmp>
    : TCmp extends Args
      ? TCmp
      : never;
  decorator?: TCmp;
}

export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<SvelteRenderer, TArgs>;

export type StoryCmp<TOverrideArgs extends Args, TMeta extends Meta> = typeof Story<
  TOverrideArgs,
  TMeta
>;

export type StoryCmpProps = ComponentProps<Story>;

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
  : never;

export interface SvelteRenderer<TCmp = any> extends WebRenderer {
  component: TCmp | Component | SvelteComponent | __sveltets_2_IsomorphicComponent;
  storyResult: SvelteStoryResult<TCmp>;
}

export interface SvelteStoryResult<TCmp = any> {
  Component: TCmp;
  props: TCmp extends Component<infer TProps>
    ? TProps
    : TCmp extends SvelteComponent<infer TProps>
      ? TProps
      : never;
  decorator?: TCmp;
}

export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<SvelteRenderer, TArgs>;

export type StoryCmp<
  TOverrideArgs extends Args = EmptyObject,
  TMeta extends Meta = Meta,
> = typeof Story<TOverrideArgs, TMeta>;

export type StoryCmpProps = ComponentProps<Story>;

import type {
  ComponentAnnotations as BaseComponentAnnotations,
  StoryAnnotations as BaseStoryAnnotations,
  StoryContext as BaseStoryContext,
  WebRenderer,
} from '@storybook/types';
import type { Component, ComponentProps } from 'svelte';
import type { SetOptional, Simplify } from 'type-fest';

export type Cmp = Component<any>;

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TCmp extends Cmp> = ComponentAnnotations<TCmp>;

export type ComponentAnnotations<TCmp extends Cmp> = BaseComponentAnnotations<
  // 👇 Renderer
  SvelteRenderer<TCmp>,
  // 👇 Args
  ComponentProps<TCmp>
>;

export interface SvelteRenderer<TCmp extends Cmp> extends WebRenderer {
  component: TCmp;
  storyResult: SvelteStoryResult<TCmp>;
}

export interface SvelteStoryResult<TCmp extends Cmp> {
  Component?: TCmp;
  props?: ComponentProps<TCmp>;
  decorator?: TCmp;
}

export type StoryContext<TCmp extends Cmp> = BaseStoryContext<
  // Renderer
  SvelteRenderer<TCmp>,
  // Args
  Simplify<TCmp>
>;

export type StoryAnnotations<TCmp extends Cmp> = BaseStoryAnnotations<
  // 👇 Renderer
  SvelteRenderer<TCmp>,
  // 👇 All of the args - combining the component props and the ones from meta - defineMeta
  ComponentProps<TCmp>,
  // NOTE: 👇 This is supposed to set all of the args specified in 'defineMeta' to be optional for Story
  // Partial<Simplify<SetOptional<ComponentProps<TCmp>, keyof Meta<TCmp>['args']>>>
  Partial<ComponentProps<TCmp>>
>;

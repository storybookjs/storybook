import type {
  Args,
  ComponentAnnotations as BaseComponentAnnotations,
  StoryAnnotations as BaseStoryAnnotations,
  StoryContext as BaseStoryContext,
  WebRenderer,
} from '@storybook/types';
import type { Component, ComponentProps, Snippet } from 'svelte';
import type { Primitive, SetOptional, Simplify } from 'type-fest';

import type Story from './runtime/Story.svelte';

export type Cmp = Component<any>;
export type CmpOrArgs = Cmp | Args;

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TCmp extends Cmp> = ComponentAnnotations<TCmp>;

export type ComponentAnnotations<TCmpOrArgs extends CmpOrArgs> = BaseComponentAnnotations<
  // Renderer
  SvelteRenderer<TCmpOrArgs>,
  // Args
  InferArgs<TCmpOrArgs>
>;

export interface SvelteRenderer<TCmpOrArgs extends CmpOrArgs> extends WebRenderer {
  component: TCmpOrArgs extends Cmp ? TCmpOrArgs : Component<TCmpOrArgs>;
  storyResult: SvelteStoryResult<TCmpOrArgs>;
}

export interface SvelteStoryResult<TCmpOrArgs extends CmpOrArgs> {
  Component?: TCmpOrArgs extends Cmp ? TCmpOrArgs : Component<TCmpOrArgs>;
  props?: TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs;
  decorator?: TCmpOrArgs extends Cmp ? TCmpOrArgs : Component<TCmpOrArgs>;
}

export type MapSnippetsToAcceptPrimitives<Props extends Args> = {
  [ArgKey in keyof Props]: Props[ArgKey] extends Snippet ? Snippet | Primitive : Props[ArgKey];
};

type InferArgs<TCmpOrArgs extends CmpOrArgs> = MapSnippetsToAcceptPrimitives<
  TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs
>;

export type StoryContext<
  TCmp extends Cmp = Cmp,
  TMeta extends Meta<TCmp> = Meta<TCmp>,
> = BaseStoryContext<
  // Renderer
  SvelteRenderer<TCmp>,
  // Args
  Simplify<TCmp extends Cmp ? ComponentProps<TCmp> : TCmp>
>;

export type StoryCmp<
  TCmp extends Cmp = Cmp,
  TMeta extends Meta<TCmp> = Meta<TCmp>,
> = typeof Story<TCmp, TMeta>;

export type StoryAnnotations<TCmp extends Cmp, TMeta extends Meta<TCmp>> = BaseStoryAnnotations<
  // Renderer
  SvelteRenderer<TCmp>,
  // All of the args - combining the component props and the ones from meta - defineMeta
  InferArgs<TCmp>,
  // Set all of the args specified in 'defineMeta' to be optional for Story
  Simplify<
    SetOptional<
      InferArgs<TCmp>,
      // FIXME: Supposed to be `keyof TMeta['args'], but doesn't work
      keyof InferArgs<TCmp>
    // keyof TMeta['args']
    >
  >
>;

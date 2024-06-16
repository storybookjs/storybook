import type {
  Args,
  ComponentAnnotations as BaseComponentAnnotations,
  StrictArgs,
  StoryAnnotations as BaseStoryAnnotations,
  StoryContext as BaseStoryContext,
  WebRenderer,
} from '@storybook/types';
import type { Component, ComponentProps, Snippet, SvelteComponent } from 'svelte';
import type { EmptyObject, Primitive, SetOptional, Simplify } from 'type-fest';

import type Story from './runtime/Story.svelte';

export type PossibleCmpType = Component | SvelteComponent | __sveltets_2_IsomorphicComponent;

// TODO: Use it, as soon as the other types start to works correctly
export type MapSnippetsToAcceptPrimitives<Props extends Args> = {
  [ArgKey in keyof Props]: Props[ArgKey] extends Snippet ? Snippet | Primitive : Props[ArgKey];
};

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TCmpOrArgs = Args> = TCmpOrArgs extends PossibleCmpType
  ? ComponentAnnotations<TCmpOrArgs>
  : TCmpOrArgs extends Args
    ? ComponentAnnotations<TCmpOrArgs>
    : never;

export type ComponentAnnotations<TCmp> = BaseComponentAnnotations<
  // Renderer
  SvelteRenderer<TCmp>,
  // Args
  MapSnippetsToAcceptPrimitives<InferCmpProps<TCmp>>
>;

export interface SvelteRenderer<TCmp> extends WebRenderer {
  component: PossibleCmpType;
  storyResult: SvelteStoryResult<TCmp>;
}

export interface SvelteStoryResult<TCmp> {
  Component?: TCmp;
  props?: Simplify<MapSnippetsToAcceptPrimitives<InferCmpProps<TCmp>>>;
  decorator?: TCmp;
}

export type StoryContext<TArgs = StrictArgs> = BaseStoryContext<SvelteRenderer<TArgs>, TArgs>;

export type StoryCmp<TOverrideArgs extends Args = Args, TMeta extends Meta = Meta> = typeof Story<
  TOverrideArgs,
  TMeta
>;

export type StoryCmpProps = ComponentProps<Story<Args, Meta>>;

// type TArgs = Simplify<ComponentProps<TCmp> & TMeta['args']>;
// type TStoryArgs = Simplify<SetOptional<TArgs, Extract<keyof TArgs, keyof TMeta['args']>>>;

export type StoryAnnotations<TMeta extends Meta> = BaseStoryAnnotations<
  // Renderer
  SvelteRenderer<
    TMeta['component'] extends PossibleCmpType
      ? TMeta['component']
      : TMeta['args'] extends Args
        ? TMeta['args']
        : never
  >,
  // All of the args - combining the component props and excluding the ones from meta - defineMeta
  Simplify<InferStoryArgs<TMeta>>,
  // Set all of the args specified in 'defineMeta' to be optional for Story
  Simplify<
    SetOptional<
      InferCmpProps<TMeta['component'] & TMeta['args']>,
      Extract<keyof InferStoryArgs<TMeta>, keyof TMeta['args']>
    >
  >
>;

type InferCmpProps<TCmp> = TCmp extends PossibleCmpType
  ? ComponentProps<TCmp>
  : TCmp extends Args
    ? TCmp
    : Args;

type InferStoryArgs<TMeta extends Meta> = InferCmpProps<TMeta['component'] & TMeta['args']>;

import type {
  Args,
  ComponentAnnotations as BaseComponentAnnotations,
  StoryAnnotations as BaseStoryAnnotations,
  StoryContext as BaseStoryContext,
  WebRenderer,
} from '@storybook/types';
import type { Component, ComponentProps, Snippet } from 'svelte';
import type { Primitive, SetOptional, Simplify } from 'type-fest';


export type Cmp = Component<any>;
export type CmpOrArgs = Cmp | Args;

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TCmpOrArgs extends CmpOrArgs> = ComponentAnnotations<TCmpOrArgs>;

export type ComponentAnnotations<TCmpOrArgs extends CmpOrArgs> = BaseComponentAnnotations<
  // Renderer
  SvelteRenderer<TCmpOrArgs>,
  // Args FIXME: REVERT IT
  // InferArgs<TCmpOrArgs>
  TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs
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

// FIXME: REVERT IT
// type InferArgs<TCmpOrArgs extends CmpOrArgs> = MapSnippetsToAcceptPrimitives<
//   TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs
// >;

export type StoryContext<
  TCmpOrArgs extends CmpOrArgs = CmpOrArgs,
> = BaseStoryContext<
  // Renderer
  SvelteRenderer<TCmpOrArgs>,
  // Args
  Simplify<TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs>
>;

// export type StoryCmp<
//   TMeta extends Meta<CmpOrArgs>,
// > = typeof Story<TMeta>;

export type StoryAnnotations<TCmpOrArgs extends CmpOrArgs> = BaseStoryAnnotations<
  // Renderer
  SvelteRenderer<TCmpOrArgs>,
  // All of the args - combining the component props and the ones from meta - defineMeta
  // FIXME: REVERT IT
  // InferArgs<TCmpOrArgs>,
  TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs,
  // NOTE: This is supposed to set all of the args specified in 'defineMeta' to be optional for Story
  Simplify<
    SetOptional<
      TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs,
      // FIXME: REVERT IT
      // InferArgs<TCmpOrArgs>,
      TCmpOrArgs extends Cmp ? ComponentProps<TCmpOrArgs> : TCmpOrArgs
    // keyof Meta<TCmpOrArgs>
    >
  >
>;

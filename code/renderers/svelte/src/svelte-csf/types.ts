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
export type Meta<CmpOrArgs extends Component | SvelteComponent | Args = Args> =
  CmpOrArgs extends Component<infer Props>
    ? ComponentAnnotations<SvelteRenderer<CmpOrArgs>, Props>
    : CmpOrArgs extends SvelteComponent<infer Props>
      ? ComponentAnnotations<SvelteRenderer<CmpOrArgs>, Props>
      : ComponentAnnotations<SvelteRenderer<CmpOrArgs>, CmpOrArgs>;

export interface SvelteRenderer<CmpOrArgs extends Component | SvelteComponent | Args = Args>
  extends WebRenderer {
  component: CmpOrArgs extends SvelteComponent<infer Props>
    ? Component<Props>
    : CmpOrArgs extends Component<infer Props>
      ? Component<Props>
      : Component<CmpOrArgs>;
  storyResult: SvelteStoryResult<CmpOrArgs>;
}

export interface SvelteStoryResult<CmpOrArgs extends Component | SvelteComponent | Args = Args> {
  Component: CmpOrArgs extends Component<infer Props>
    ? Component<Props>
    : CmpOrArgs extends SvelteComponent<infer Props>
      ? Component<Props>
      : Component<CmpOrArgs>;
  props: CmpOrArgs extends Component<infer Props>
    ? Props
    : CmpOrArgs extends SvelteComponent<infer Props>
      ? Props
      : CmpOrArgs;
  decorator?: CmpOrArgs extends Component<infer Props>
    ? Component<Props>
    : CmpOrArgs extends SvelteComponent<infer Props>
      ? Component<Props>
      : Component<CmpOrArgs>;
}

export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<SvelteRenderer, TArgs>;

export type StoryCmp<
  TOverrideArgs extends Args = EmptyObject,
  TMeta extends Meta = Meta,
> = typeof Story<TOverrideArgs, TMeta>;

export type StoryCmpProps = ComponentProps<Story>;

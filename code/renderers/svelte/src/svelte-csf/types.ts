import type {
  Args,
  ComponentAnnotations,
  StrictArgs,
  StoryContext as GenericStoryContext,
  WebRenderer,
} from '@storybook/types';
import type { Component, ComponentProps, Snippet } from 'svelte';
import type { EmptyObject, Primitive } from 'type-fest';

import type Story from './runtime/Story.svelte';

// TODO: Use it, as soon as the other types start to works correctly
type MapSnippetsToAcceptPrimitives<Props extends ComponentProps<Component>> = {
  [ArgKey in keyof Props]?: Props[ArgKey] extends Snippet ? Snippet | Primitive : Props[ArgKey];
};

// /**
//  * Metadata to configure the stories for a component.
//  *
//  * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
//  */
// export type Meta<CmpOrArgs extends SvelteComponent | Args = Args> =
//   CmpOrArgs extends SvelteComponent
//     ? ComponentAnnotations<
//         SvelteRenderer<SvelteComponent<ComponentProps<CmpOrArgs>>>,
//         ComponentProps<CmpOrArgs>
//       >
//     : ComponentAnnotations<SvelteRenderer<SvelteComponent<CmpOrArgs>>, CmpOrArgs>;

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<CmpOrArgs extends Component<any, any, any> | Args = Args> =
  CmpOrArgs extends Component<infer Props, infer _Exports, infer _Bindings>
    ? ComponentAnnotations<SvelteRenderer<CmpOrArgs>, Props>
    : ComponentAnnotations<SvelteRenderer<CmpOrArgs>, CmpOrArgs>;

export interface SvelteRenderer<CmpOrArgs extends Component<any, any, any> | Args = Args>
  extends WebRenderer {
  component: CmpOrArgs extends Component<infer Props, infer Exports, infer Bindings>
    ? Component<Props, Exports, Bindings>
    : Component<CmpOrArgs, any, any>;
  storyResult: SvelteStoryResult<CmpOrArgs>;
}

export interface SvelteStoryResult<CmpOrArgs extends Component<any, any, any> | Args = Args> {
  Component: CmpOrArgs extends Component<infer Props, infer Exports, infer Bindings>
    ? Component<Props, Exports, Bindings>
    : Component<CmpOrArgs, any, any>;
  props?: CmpOrArgs extends Component<infer Props, infer _Exports, infer _Bindings>
    ? Props
    : CmpOrArgs;
  decorator: CmpOrArgs extends Component<infer Props, infer Exports, infer Bindings>
    ? Component<Props, Exports, Bindings>
    : Component<CmpOrArgs, any, any>;
}

export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<SvelteRenderer, TArgs>;

export type StoryCmp<
  TOverrideArgs extends Args = EmptyObject,
  TMeta extends Meta = Meta,
> = typeof Story<TOverrideArgs, TMeta>;

export type StoryCmpProps = ComponentProps<Story>;

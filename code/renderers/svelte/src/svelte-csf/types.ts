/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ComponentAnnotations as BaseComponentAnnotations,
  StoryAnnotations as BaseStoryAnnotations,
} from 'storybook/internal/types';
import type { Component, Snippet } from 'svelte';

import type { StoryContext } from '../public-types.ts';
import type { SvelteRenderer } from '../types.ts';

export type { StoryContext, SvelteRenderer };

export type Cmp = Component<any>;

export type ComponentAnnotations<
  TCmp extends Cmp,
  TArgs extends Record<string, any> = Record<string, any>,
> = Omit<
  BaseComponentAnnotations<
    // 👇 Renderer
    SvelteRenderer<TCmp>,
    // 👇 Args
    TArgs
  >,
  'subcomponents'
> & {
  // Subcomponents can use different props from the primary component. Keep
  // them out of TCmp inference so they do not widen the story args type.
  subcomponents?: Record<string, Cmp>;
};

export type StoryAnnotations<
  TArgs extends Record<string, any>,
  TCmp extends Cmp,
> = BaseStoryAnnotations<
  // 👇 Renderer
  SvelteRenderer<TCmp>,
  // 👇 All of the args - combining the component props and the ones from meta - defineMeta
  TArgs,
  // NOTE: 👇 This is supposed to set all of the args specified in 'defineMeta' to be optional for Story
  // Partial<Simplify<SetOptional<ComponentProps<TCmp>, keyof Meta<TCmp>['args']>>>
  Partial<TArgs>
>;

export type StoryProps<
  TArgs extends Record<string, any>,
  TCmp extends Cmp,
  TChildren extends Snippet = Snippet,
> = Partial<StoryAnnotations<TArgs, TCmp>> & {
  /** Name of the story. Can be omitted if `exportName` is provided. */
  name?: string;
  /**
   * Export name of the story. Defaults to `name` in PascalCase, for example `'My story!'` becomes `MyStory`.
   *
   * Set it when two names give the same export name, such as "My story" and "My story!", or to import the story in MDX.
   */
  exportName?: string;
} & (
    | {
        /**
         * Export name of the story. Defaults to `name` in PascalCase, for example `'My story!'` becomes `MyStory`.
         *
         * Set it when two names give the same export name, such as "My story" and "My story!", or to import the story in MDX.
         */
        exportName: string;
      }
    | {
        /** Name of the story. Can be omitted if `exportName` is provided. */
        name: string;
      }
  ) &
  (
    | {
        /** Children to pass to the story's component, or with `asChild`, the static markup to render. */
        children?: TChildren;
        /** Render the children as the story content, for a static story. */
        asChild?: boolean;
        template?: never;
      }
    | {
        children?: never;
        asChild?: never;
        /**
         * Snippet that renders the story, called with `args` and `storyContext`.
         *
         * Can be omitted when `defineMeta` sets a default template with `render`.
         */
        template?: Snippet<[TArgs, StoryContext<TArgs>]>;
      }
  );

// The type of the `Story` component that `defineMeta` returns.
export type StoryComponent<TArgs extends Record<string, any>, TCmp extends Cmp> = Component<
  StoryProps<TArgs, TCmp>
>;

// The props of a `<Story>`. `extend` is a prop of the stories of `preview.meta()` only.
export type RegisteredStoryProps<TCmp extends Cmp> = StoryProps<Record<string, any>, TCmp> & {
  extend?: string;
};

// The contexts in static/svelte-csf/contexts/, which are JavaScript, use these types through JSDoc.
export interface StoriesExtractorContextProps<TCmp extends Cmp> {
  isExtracting: boolean;
  register: (storyCmpProps: RegisteredStoryProps<TCmp>) => void;
}

export type StoriesExtractorContext<TCmp extends Cmp> = Readonly<
  StoriesExtractorContextProps<TCmp>
>;

export type StoriesRepository<TCmp extends Cmp> = {
  stories: Map<string, RegisteredStoryProps<TCmp>>;
};

export interface StoryRendererContextProps<TCmp extends Cmp> {
  // The `<Story>` that renders its content, which is the one of a parent story when the story
  // extends a story and has no content of its own
  contentExportName: string | undefined;
  // The `<Story>` whose play function runs
  playExportName: string | undefined;
  // The `<Story>` that sets `asChild`, which reads its own prop, and the value it had when the
  // stories were extracted, for the other `<Story>` components
  asChildExportName: string | undefined;
  asChild: boolean;
  args: NonNullable<StoryAnnotations<Record<string, any>, TCmp>['args']>;
  storyContext: StoryContext<Record<string, any>>;
  metaRenderSnippet?: Snippet<
    [StoryAnnotations<Record<string, any>, TCmp>['args'], StoryContext<Record<string, any>>]
  >;
}

export type StoryRendererContext<TCmp extends Cmp = Cmp> = Readonly<
  Required<Omit<StoryRendererContextProps<TCmp>, 'metaRenderSnippet'>>
> & {
  readonly metaRenderSnippet: StoryRendererContextProps<TCmp>['metaRenderSnippet'];
  set(props: StoryRendererContextProps<TCmp>): void;
};

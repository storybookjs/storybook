/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ComponentAnnotations as BaseComponentAnnotations,
  StoryAnnotations as BaseStoryAnnotations,
  StoryContext as BaseStoryContext,
  WebRenderer,
} from 'storybook/internal/types';
import type { Component, ComponentProps, Snippet } from 'svelte';

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

export interface SvelteRenderer<TCmp extends Cmp> extends WebRenderer {
  component: TCmp;
  storyResult: SvelteStoryResult<TCmp>;
}

export interface SvelteStoryResult<TCmp extends Cmp> {
  Component?: TCmp;
  props?: ComponentProps<TCmp>;
  decorator?: TCmp;
}

export type StoryContext<TArgs extends Record<string, any>> = BaseStoryContext<
  // Renderer
  SvelteRenderer<Component<TArgs>>,
  // Args
  TArgs
>;

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
  /**
   * @deprecated
   * Use `exportName` instead.
   */
  id?: never;
  /**
   * Name of the story. Can be omitted if `exportName` is provided.
   */
  name?: string;
  /**
   * exportName of the story.
   * If not provided, it will be generated from the 'name', by converting it to a valid, PascalCased JS variable name.
   * eg. 'My story!' -> 'MyStory'
   *
   * Use this prop to explicitly set the export name of the story. This is useful if you have multiple stories with the names
   * that result in duplicate export names like "My story" and "My story!".
   * It's also useful for explicitly defining the export that can be imported in MDX docs.
   */
  exportName?: string;
  /**
   * @deprecrated
   * Use `tags={['autodocs']}` instead.
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#story-prop-autodocs-has-been-removed}
   */
  autodocs?: never;
  /**
   * @deprecated
   * Use `parameters={{ docs: { source: { code: "..." } } }}` instead.
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/next/MIGRATION.md#story-prop-source-has-been-removed}
   */
  source?: never;
} & (
    | {
        /**
         * exportName of the story.
         * If not provided, it will be generated from the 'name', by converting it to a valid, PascalCased JS variable name.
         * eg. 'My story!' -> 'MyStory'
         *
         * Use this prop to explicitly set the export name of the story. This is useful if you have multiple stories with the names
         * that result in duplicate export names like "My story" and "My story!".
         * It's also useful for explicitly defining the export that can be imported in MDX docs.
         */
        exportName: string;
      }
    | {
        /**
         * Name of the story. Can be omitted if `exportName` is provided.
         */
        name: string;
      }
  ) &
  (
    | {
        /**
         * Children to pass to the story's component
         * Or if `asChild` is true, the content to render in the story as **static** markup.
         */
        children?: TChildren;
        /**
         * Make the children the actual story content. This is useful when you want to create a **static story**.
         */
        asChild?: boolean;
        template?: never;
      }
    | {
        children?: never;
        asChild?: never;
        /**
         * The content to render in the story with a snippet taking `args` and `storyContext` as parameters
         *
         * NOTE: Can be omitted if a default template is set with [`render`](https://github.com/storybookjs/addon-svelte-csf/blob/main/README.md#default-snippet)
         */
        template?: Snippet<[TArgs, StoryContext<TArgs>]>;
      }
  );

// The type of the `Story` component that `defineMeta` returns.
export type StoryComponent<TArgs extends Record<string, any>, TCmp extends Cmp> = Component<
  StoryProps<TArgs, TCmp>
>;

// The contexts in static/svelte-csf/contexts/, which are JavaScript, use these types through JSDoc.
export interface StoriesExtractorContextProps<TCmp extends Cmp> {
  isExtracting: boolean;
  register: (storyCmpProps: StoryProps<Record<string, any>, TCmp>) => void;
}

export type StoriesExtractorContext<TCmp extends Cmp> = Readonly<
  StoriesExtractorContextProps<TCmp>
>;

export type StoriesRepository<TCmp extends Cmp> = {
  stories: Map<string, StoryProps<Record<string, any>, TCmp>>;
};

export interface StoryRendererContextProps<TCmp extends Cmp> {
  currentStoryExportName: string | undefined;
  args: NonNullable<StoryAnnotations<Record<string, any>, TCmp>['args']>;
  storyContext: StoryContext<TCmp>;
  metaRenderSnippet?: Snippet<
    [StoryAnnotations<Record<string, any>, TCmp>['args'], StoryContext<TCmp>]
  >;
}

export type StoryRendererContext<TCmp extends Cmp = Cmp> = Readonly<
  Required<Omit<StoryRendererContextProps<TCmp>, 'metaRenderSnippet'>>
> & {
  readonly metaRenderSnippet: StoryRendererContextProps<TCmp>['metaRenderSnippet'];
  set(props: StoryRendererContextProps<TCmp>): void;
};

import type {
  AddonTypes,
  InferTypes,
  Meta,
  MetaInput,
  MetaTypes,
  Preview,
  PreviewAddonEntry,
  Story,
  StoryArgs,
  TypedMetaArgKeys,
  WithRenderArgs,
} from 'storybook/internal/csf';
import { definePreview as definePreviewBase } from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  DecoratorFunction,
  ProjectAnnotations,
  StoryAnnotations,
  StoryContext,
} from 'storybook/internal/types';

import StoryComponent from '@storybook/svelte/internal/svelte-csf/Story.svelte';
import type { Component, ComponentProps, Snippet } from 'svelte';
import type { Simplify } from 'type-fest';

import * as svelteAnnotations from './entry-preview.ts';
import * as svelteDocsAnnotations from './entry-preview-docs.ts';
import type { SvelteTypes } from './types.ts';

/**
 * Define the preview of a Svelte project, with the `preview.meta()` and `meta.story()` factories.
 *
 * @example
 *
 * ```ts
 * // .storybook/preview.ts
 * import { definePreview } from '@storybook/svelte-vite';
 *
 * export default definePreview({
 *   addons: [],
 *   parameters: { layout: 'centered' },
 * });
 * ```
 */
export function __definePreview<Addons extends PreviewAddonEntry[]>(
  input: { addons: Addons } & ProjectAnnotations<SvelteTypes & InferTypes<Addons>>
): SveltePreview<SvelteTypes & InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [svelteAnnotations, svelteDocsAnnotations, ...(input.addons ?? [])],
  });
  const meta = preview.meta.bind(preview);
  // Svelte CSF files render their stories with the `Story` component of the meta.
  preview.meta = ((metaInput: Parameters<typeof meta>[0]) =>
    Object.assign(meta(metaInput as never), { Story: StoryComponent })) as typeof meta;
  return preview as SveltePreview<SvelteTypes & InferTypes<Addons>>;
}

// A component typed as `any` or by the `*.svelte` shim has no known props, so it takes any args.
type InferComponentArgs<C> =
  C extends Component<any, any, any>
    ? [keyof ComponentProps<C>] extends [never]
      ? Args
      : ComponentProps<C>
    : Args;

// Svelte CSF files set the default template of their stories with a snippet. The snippet member has
// the same parameters as `ArgsStoryFn`, so that a `render` function still gets its args typed.
type MetaRender<T extends SvelteTypes, TArgs> =
  | ArgsStoryFn<T, TArgs>
  | ((...args: Parameters<ArgsStoryFn<T, TArgs>>) => ReturnType<Snippet>);

/**
 * The preview returned by `definePreview`. `preview.meta()` infers the args from the props of the
 * component, the decorators, and the addons.
 */
export interface SveltePreview<T extends AddonTypes> extends Preview<SvelteTypes & T> {
  /**
   * Add types to the metas created from the returned preview, such as an arg that the component
   * doesn't declare: `preview.type<{ args: { theme: 'light' | 'dark' } }>().meta({ component })`.
   */
  type<R>(): SveltePreview<T & R>;

  meta<
    C,
    Decorators extends DecoratorFunction<SvelteTypes & T, any>,
    TRenderArgs = unknown,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      component: C;
      render?: MetaRender<SvelteTypes & T, InferComponentArgs<C> & TRenderArgs & T['args']>;
    } & MetaInput<
      SvelteTypes & T,
      WithRenderArgs<InferComponentArgs<C>, TRenderArgs>,
      Decorators,
      TMetaArgKeys
    >
  ): SvelteMeta<
    MetaTypes<
      SvelteTypes & T,
      WithRenderArgs<InferComponentArgs<C>, TRenderArgs>,
      Decorators,
      TMetaArgKeys
    >,
    TMetaArgKeys
  >;

  meta<
    TArgs extends Args,
    Decorators extends DecoratorFunction<SvelteTypes & T, any>,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      render?: MetaRender<SvelteTypes & T, TArgs & T['args']>;
    } & MetaInput<SvelteTypes & T, TArgs, Decorators, TMetaArgKeys>
  ): SvelteMeta<MetaTypes<SvelteTypes & T, TArgs, Decorators, TMetaArgKeys>, TMetaArgKeys>;
}

/**
 * The meta returned by `preview.meta()`. Args set in meta are optional in its stories; the other
 * required args must be set in each story.
 */
export interface SvelteMeta<
  T extends SvelteTypes,
  TMetaArgKeys extends PropertyKey = never,
> extends Meta<T, TMetaArgKeys> {
  /** The component that creates the stories of a Svelte CSF file. */
  Story: Component<SvelteCsfStoryProps<T, TMetaArgKeys>>;

  /** Create a story with a render that takes no args, so the story needs no args. */
  story<
    TInput extends
      | (() => SvelteTypes['storyResult'])
      | (StoryAnnotations<T, T['args']> & { render: () => SvelteTypes['storyResult'] }),
  >(
    story: TInput
  ): SvelteStory<T, TInput extends () => SvelteTypes['storyResult'] ? { render: TInput } : TInput>;

  /** Create a story. It must set the required args that meta didn't set. */
  story<
    TInput extends Simplify<StoryAnnotations<T, T['args'], StoryArgs<T['args'], TMetaArgKeys>>>,
  >(
    story: TInput
  ): SvelteStory<T, TInput>;

  /** Create a story without annotations. Only allowed when meta sets every required arg. */
  story(
    ..._args: Partial<T['args']> extends StoryArgs<T['args'], TMetaArgKeys> ? [] : [never]
  ): SvelteStory<T, {}>;

  /**
   * Add types to the stories created from the returned meta, such as an arg that only one story
   * has: `meta.type<{ args: { icon: string } }>().story({ args: { icon: 'star' } })`.
   */
  type<S>(): SvelteMeta<T & S, TypedMetaArgKeys<TMetaArgKeys, S>>;
}

/** The story returned by `meta.story()`. */
export interface SvelteStory<
  T extends SvelteTypes,
  TInput extends StoryAnnotations<T, T['args']>,
> extends Story<T, TInput> {}

type ArgsProp<TArgs> = {} extends TArgs ? { args?: TArgs } : { args: TArgs };

/**
 * The props of the `Story` component of a Svelte CSF file. Args that meta didn't set are required,
 * unless the story renders static content: `asChild`, or a `template` snippet without parameters.
 */
export type SvelteCsfStoryProps<
  T extends SvelteTypes,
  TMetaArgKeys extends PropertyKey = never,
> = Omit<StoryAnnotations<T, T['args']>, 'args' | 'name' | 'render'> &
  (
    | {
        /** The name of the story. Can be omitted when `exportName` is set. */
        name?: string;
        /**
         * The name of the story export. Defaults to the `name` in PascalCase, for example `'My
         * story!'` becomes `'MyStory'`. Set it when two names give the same export name, or to
         * import the story in MDX docs.
         */
        exportName: string;
      }
    | { name: string; exportName?: undefined }
  ) &
  // TypeScript reports a type error against the last member that doesn't match, so a story with
  // only args is last: its error names the missing args.
  (
    | {
        template: Snippet<[]>;
        children?: never;
        asChild?: never;
        args?: Partial<T['args']>;
      }
    | {
        template?: never;
        children: Snippet;
        /** Render the children as the static content of the story, without the component. */
        asChild: true;
        args?: Partial<T['args']>;
      }
    | ({
        template?: never;
        /** The children of the component. With `asChild`, the static content of the story. */
        children: Snippet;
        asChild?: false;
        // The children of the story are the `children` arg of the component.
      } & ArgsProp<StoryArgs<T['args'], TMetaArgKeys | 'children'>>)
    | ({
        /** Render the story with this snippet, which takes the args and the story context. */
        template: Snippet<[T['args'], StoryContext<T, T['args']>]>;
        children?: never;
        asChild?: never;
      } & ArgsProp<StoryArgs<T['args'], TMetaArgKeys>>)
    | ({
        template?: never;
        children?: never;
        asChild?: false;
      } & ArgsProp<StoryArgs<T['args'], TMetaArgKeys>>)
  );

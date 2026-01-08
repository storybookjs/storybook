import type {
  AddonTypes,
  InferTypes,
  Meta,
  Preview,
  PreviewAddon,
  Story,
} from 'storybook/internal/csf';
import { definePreview as definePreviewBase } from 'storybook/internal/csf';
import type {
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';

import type { RemoveIndexSignature, SetOptional, Simplify, UnionToIntersection } from 'type-fest';

import * as webComponentsAnnotations from './entry-preview';
import * as webComponentsDocsAnnotations from './entry-preview-docs';
import { type WebComponentsTypes } from './types';

/**
 * Creates a Web Components-specific preview configuration with CSF factories support.
 *
 * This function wraps the base `definePreview` and adds Web Components-specific annotations
 * for rendering and documentation. It returns a `WebComponentsPreview` that provides
 * type-safe `meta()` and `story()` factory methods.
 *
 * @example
 * ```ts
 * // .storybook/preview.ts
 * import { definePreview } from '@storybook/web-components';
 *
 * export const preview = definePreview({
 *   addons: [],
 *   parameters: { layout: 'centered' },
 * });
 * ```
 */
export function __definePreview<Addons extends PreviewAddon<never>[]>(
  input: { addons: Addons } & ProjectAnnotations<WebComponentsTypes & InferTypes<Addons>>
): WebComponentsPreview<WebComponentsTypes & InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [webComponentsAnnotations, webComponentsDocsAnnotations, ...(input.addons ?? [])],
  }) as unknown as WebComponentsPreview<WebComponentsTypes & InferTypes<Addons>>;

  return preview;
}

type InferArgs<TArgs, T, Decorators> = Simplify<
  TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<WebComponentsTypes & T, Decorators>>>
>;

type InferWebComponentsTypes<T, TArgs, Decorators> = WebComponentsTypes &
  T & { args: Simplify<InferArgs<TArgs, T, Decorators>> };

/**
 * Web Components-specific Preview interface that provides type-safe CSF factory methods.
 *
 * Use `preview.meta()` to create a meta configuration for a component, and then
 * `meta.story()` to create individual stories. The type system will infer args
 * from the HTMLElement type when using a tag name as the component.
 *
 * @example
 * ```ts
 * const meta = preview.meta({ component: 'my-button' });
 * export const Primary = meta.story({ args: { label: 'Click me' } });
 * ```
 */
export interface WebComponentsPreview<T extends AddonTypes>
  extends Preview<WebComponentsTypes & T> {
  /**
   * Narrows the type of the preview to include additional type information.
   * This is useful when you need to add args that aren't inferred from the component.
   *
   * @example
   * ```ts
   * const meta = preview.type<{ args: { theme: 'light' | 'dark' } }>().meta({
   *   component: 'my-button',
   * });
   * ```
   */
  type<S>(): WebComponentsPreview<T & S>;

  meta<
    C extends keyof HTMLElementTagNameMap,
    Decorators extends DecoratorFunction<WebComponentsTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<HTMLElementTagNameMap[C] & T['args']>,
  >(
    meta: {
      component?: C;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<WebComponentsTypes & T, Partial<HTMLElementTagNameMap[C]> & T['args']>,
      'decorators' | 'component' | 'args'
    >
  ): WebComponentsMeta<
    InferWebComponentsTypes<T, Partial<HTMLElementTagNameMap[C]>, Decorators>,
    Omit<
      ComponentAnnotations<
        InferWebComponentsTypes<T, Partial<HTMLElementTagNameMap[C]>, Decorators>
      >,
      'args'
    > & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;

  meta<
    TArgs,
    Decorators extends DecoratorFunction<WebComponentsTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<TArgs>,
  >(
    meta: {
      render?: ArgsStoryFn<WebComponentsTypes & T, TArgs>;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<WebComponentsTypes & T, TArgs & T['args']>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): WebComponentsMeta<
    InferWebComponentsTypes<T, TArgs, Decorators>,
    Omit<ComponentAnnotations<InferWebComponentsTypes<T, TArgs, Decorators>>, 'args'> & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;
}

/** Extracts and unions all args types from an array of decorators. */
type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

/**
 * Web Components-specific Meta interface returned by `preview.meta()`.
 *
 * Provides the `story()` method to create individual stories with proper type inference.
 * Args provided in meta become optional in stories, while missing required args must be
 * provided at the story level.
 */
export interface WebComponentsMeta<
  T extends WebComponentsTypes,
  MetaInput extends ComponentAnnotations<T>,
  /**
   * @ts-expect-error WebComponentsMeta requires two type parameters to track both inferred
   * component types (T) and custom meta annotations (MetaInput), but Meta only accepts compatible params.
   */
> extends Meta<T, MetaInput> {
  // meta.story(() => html`<div></div>`)
  story<
    TInput extends
      | (() => WebComponentsTypes['storyResult'])
      // Required args don't need to be provided when the user uses an empty render
      | (StoryAnnotations<T, T['args']> & {
          render: () => WebComponentsTypes['storyResult'];
        }),
  >(
    story: TInput
  ): WebComponentsStory<
    T,
    TInput extends () => WebComponentsTypes['storyResult'] ? { render: TInput } : TInput
  >;

  // meta.story({ args: {} })
  story<
    TInput extends Simplify<
      StoryAnnotations<
        T,
        T['args'],
        SetOptional<T['args'], keyof T['args'] & keyof MetaInput['args']>
      >
    >,
  >(
    story: TInput
  ): WebComponentsStory<T, TInput>;

  /**
   * Creates a story with no additional configuration.
   *
   * This overload is only available when all required args have been provided in meta.
   * The conditional type `Partial<T['args']> extends SetOptional<...>` checks if the
   * remaining required args (after accounting for args provided in meta) are all optional.
   * If so, the function accepts zero arguments `[]`. Otherwise, it requires `[never]`
   * which makes this overload unmatchable, forcing the user to provide args.
   *
   * @example
   * ```ts
   * // When meta provides all required args, story() can be called with no arguments
   * const meta = preview.meta({ component: 'my-button', args: { label: 'Hi' } });
   * export const Default = meta.story(); // Valid - all args provided in meta
   * ```
   */
  story(
    ..._args: Partial<T['args']> extends SetOptional<
      T['args'],
      keyof T['args'] & keyof MetaInput['args']
    >
      ? []
      : [never]
  ): WebComponentsStory<T, {}>;
}

/**
 * Web Components-specific Story interface returned by `meta.story()`.
 *
 * Represents a single story with its configuration and provides access to
 * the composed story for testing via `story.run()`.
 */
export interface WebComponentsStory<
  T extends WebComponentsTypes,
  TInput extends StoryAnnotations<T, T['args']>,
> extends Story<T, TInput> {}

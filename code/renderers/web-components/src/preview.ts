import type {
  AddonTypes,
  InferTypes,
  Meta,
  MetaInput,
  MetaTypes,
  StoryArgs,
  TypedMetaArgKeys,
  WithRenderArgs,
  Preview,
  PreviewAddon,
  Story,
} from 'storybook/internal/csf';
import { definePreview as definePreviewBase } from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  DecoratorFunction,
  ProjectAnnotations,
  StoryAnnotations,
} from 'storybook/internal/types';

import type { Simplify } from 'type-fest';

import * as webComponentsAnnotations from './entry-preview.ts';
import * as webComponentsDocsAnnotations from './entry-preview-docs.ts';
import { type WebComponentsTypes } from './types.ts';

/**
 * Creates a Web Components-specific preview configuration with CSF factories support.
 *
 * This function wraps the base `definePreview` and adds Web Components-specific annotations for
 * rendering and documentation. It returns a `WebComponentsPreview` that provides type-safe `meta()`
 * and `story()` factory methods.
 *
 * @example
 *
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
  }) as WebComponentsPreview<WebComponentsTypes & InferTypes<Addons>>;

  return preview;
}

/**
 * Infers args from a web component's HTMLElement type, allowing both camelCase properties and
 * kebab-case HTML attribute names (e.g., 'aria-label', 'data-testid', 'static-color').
 */
type InferArgsFromComponent<C extends keyof HTMLElementTagNameMap> = Partial<
  HTMLElementTagNameMap[C]
> &
  Record<`${string}-${string}`, unknown>;

/**
 * Web Components-specific Preview interface that provides type-safe CSF factory methods.
 *
 * Use `preview.meta()` to create a meta configuration for a component, and then `meta.story()` to
 * create individual stories. The type system will infer args from the HTMLElement type when using a
 * tag name as the component.
 *
 * @example
 *
 * ```ts
 * const meta = preview.meta({ component: 'my-button' });
 * export const Primary = meta.story({ args: { label: 'Click me' } });
 * ```
 */
export interface WebComponentsPreview<T extends AddonTypes> extends Preview<
  WebComponentsTypes & T
> {
  /**
   * Narrows the type of the preview to include additional type information. This is useful when you
   * need to add args that aren't inferred from the component.
   *
   * @example
   *
   * ```ts
   * const meta = preview.type<{ args: { theme: 'light' | 'dark' } }>().meta({
   *   component: 'my-button',
   * });
   * ```
   */
  type<S>(): WebComponentsPreview<T & S>;

  meta<
    // Without this default, a meta without `component` expands every tag name while checking this
    // overload and fails with "union type too complex" instead of trying the next one.
    C extends keyof HTMLElementTagNameMap = never,
    Decorators extends DecoratorFunction<WebComponentsTypes & T, any> = DecoratorFunction<
      WebComponentsTypes & T,
      any
    >,
    TRenderArgs = unknown,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      component: C;
      render?: ArgsStoryFn<
        WebComponentsTypes & T,
        InferArgsFromComponent<C> & TRenderArgs & T['args']
      >;
    } & MetaInput<
      WebComponentsTypes & T,
      WithRenderArgs<InferArgsFromComponent<C>, TRenderArgs>,
      Decorators,
      TMetaArgKeys
    >
  ): WebComponentsMeta<
    MetaTypes<
      WebComponentsTypes & T,
      WithRenderArgs<InferArgsFromComponent<C>, TRenderArgs>,
      Decorators,
      TMetaArgKeys
    >,
    TMetaArgKeys
  >;

  meta<
    TArgs = Args,
    Decorators extends DecoratorFunction<WebComponentsTypes & T, any> = DecoratorFunction<
      WebComponentsTypes & T,
      any
    >,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      render?: ArgsStoryFn<WebComponentsTypes & T, TArgs>;
    } & MetaInput<WebComponentsTypes & T, TArgs, Decorators, TMetaArgKeys>
  ): WebComponentsMeta<
    MetaTypes<WebComponentsTypes & T, TArgs, Decorators, TMetaArgKeys>,
    TMetaArgKeys
  >;
}

/**
 * Web Components-specific Meta interface returned by `preview.meta()`.
 *
 * Provides the `story()` method to create individual stories with proper type inference. Args
 * provided in meta become optional in stories, while missing required args must be provided at the
 * story level.
 */
export interface WebComponentsMeta<
  T extends WebComponentsTypes,
  TMetaArgKeys extends PropertyKey = never,
> extends Meta<T, TMetaArgKeys> {
  /**
   * Creates a story with a custom render function that takes no args.
   *
   * This overload allows you to define a story using just a render function or an object with a
   * render function that doesn't depend on args. Since the render function doesn't use args, no
   * args need to be provided regardless of what's required by the component.
   *
   * @example
   *
   * ```ts
   * // Using just a render function with lit-html
   * export const CustomTemplate = meta.story(() => html`<div>Custom content</div>`);
   *
   * // Using an object with render
   * export const WithRender = meta.story({
   *   render: () => html`<my-element></my-element>`,
   * });
   * ```
   */
  story<
    TInput extends
      | (() => WebComponentsTypes['storyResult'])
      | (StoryAnnotations<T, T['args']> & {
          render: () => WebComponentsTypes['storyResult'];
        }),
  >(
    story: TInput
  ): WebComponentsStory<
    T,
    TInput extends () => WebComponentsTypes['storyResult'] ? { render: TInput } : TInput
  >;

  /**
   * Creates a story with custom configuration including args, decorators, or other annotations.
   *
   * This is the primary overload for defining stories. Args that were already provided in meta
   * become optional, while any remaining required args must be specified here.
   *
   * @example
   *
   * ```ts
   * // Provide required args not in meta
   * export const Primary = meta.story({
   *   args: { label: 'Click me', disabled: false },
   * });
   *
   * // Override meta args and add story-specific configuration
   * export const Disabled = meta.story({
   *   args: { disabled: true },
   *   decorators: [withCustomWrapper],
   * });
   * ```
   */
  story<
    TInput extends Simplify<StoryAnnotations<T, T['args'], StoryArgs<T['args'], TMetaArgKeys>>>,
  >(
    story: TInput
  ): WebComponentsStory<T, TInput>;

  /**
   * Creates a story with no additional configuration.
   *
   * This overload is only available when all required args have been provided in meta. The
   * conditional type `Partial<T['args']> extends StoryArgs<...>` checks if the remaining required
   * args (after accounting for args provided in meta) are all optional. If so, the function accepts
   * zero arguments `[]`. Otherwise, it requires `[never]` which makes this overload unmatchable,
   * forcing the user to provide args.
   *
   * @example
   *
   * ```ts
   * // When meta provides all required args, story() can be called with no arguments
   * const meta = preview.meta({ component: 'my-button', args: { label: 'Hi' } });
   * export const Default = meta.story(); // Valid - all args provided in meta
   * ```
   */
  story(
    ..._args: Partial<T['args']> extends StoryArgs<T['args'], TMetaArgKeys> ? [] : [never]
  ): WebComponentsStory<T, {}>;

  /**
   * Add types to the stories created from the returned meta, such as an arg that only one story
   * has: `meta.type<{ args: { icon: string } }>().story({ args: { icon: 'star' } })`.
   */
  type<S>(): WebComponentsMeta<T & S, TypedMetaArgKeys<TMetaArgKeys, S>>;
}

/**
 * Web Components-specific Story interface returned by `meta.story()`.
 *
 * Represents a single story with its configuration and provides access to the composed story for
 * testing via `story.run()`.
 */
export interface WebComponentsStory<
  T extends WebComponentsTypes,
  TInput extends StoryAnnotations<T, T['args']>,
> extends Story<T, TInput> {}

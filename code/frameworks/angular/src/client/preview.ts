import type {
  AddonTypes,
  InferTypes,
  Meta,
  MetaInput,
  MetaTypes,
  StoryArgs,
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

import * as angularAnnotations from './config.ts';
import * as angularDocsAnnotations from './docs/config.ts';
import type { TransformComponentType } from './public-types.ts';
import { type AngularRenderer } from './types.ts';

/**
 * Creates an Angular-specific preview configuration with CSF factories support.
 *
 * This function wraps the base `definePreview` and adds Angular-specific annotations for rendering
 * and documentation. It returns an `AngularPreview` that provides type-safe `meta()` and `story()`
 * factory methods.
 *
 * @example
 *
 * ```ts
 * // .storybook/preview.ts
 * import { definePreview } from '@storybook/angular';
 *
 * export const preview = definePreview({
 *   addons: [],
 *   parameters: { layout: 'centered' },
 * });
 * ```
 */
export function __definePreview<Addons extends PreviewAddon<never>[]>(
  input: { addons: Addons } & ProjectAnnotations<AngularRenderer & InferTypes<Addons>>
): AngularPreview<AngularRenderer & InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [angularAnnotations, angularDocsAnnotations, ...(input.addons ?? [])],
  }) as AngularPreview<AngularRenderer & InferTypes<Addons>>;

  return preview;
}

type InferComponentArgs<C extends abstract new (...args: any) => any> = Partial<
  TransformComponentType<InstanceType<C>>
>;

/**
 * Angular-specific Preview interface that provides type-safe CSF factory methods.
 *
 * Use `preview.meta()` to create a meta configuration for a component, and then `meta.story()` to
 * create individual stories. The type system will infer args from the component, decorators, and
 * any addon types.
 *
 * @example
 *
 * ```ts
 * const meta = preview.meta({ component: ButtonComponent });
 * export const Primary = meta.story({ args: { label: 'Click me' } });
 * ```
 */
export interface AngularPreview<T extends AddonTypes> extends Preview<AngularRenderer & T> {
  /**
   * Narrows the type of the preview to include additional type information. This is useful when you
   * need to add args that aren't inferred from the component.
   *
   * @example
   *
   * ```ts
   * const meta = preview.type<{ args: { theme: 'light' | 'dark' } }>().meta({
   *   component: ButtonComponent,
   * });
   * ```
   */
  type<S>(): AngularPreview<T & S>;

  meta<
    C extends abstract new (...args: any) => any,
    Decorators extends DecoratorFunction<AngularRenderer & T, any>,
    TRenderArgs = unknown,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      component: C;
      render?: ArgsStoryFn<AngularRenderer & T, InferComponentArgs<C> & TRenderArgs & T['args']>;
    } & MetaInput<
      AngularRenderer & T,
      WithRenderArgs<InferComponentArgs<C>, TRenderArgs>,
      Decorators,
      TMetaArgKeys
    >
  ): AngularMeta<
    MetaTypes<
      AngularRenderer & T,
      WithRenderArgs<InferComponentArgs<C>, TRenderArgs>,
      Decorators,
      TMetaArgKeys
    >,
    TMetaArgKeys
  >;

  meta<
    TArgs = Args,
    Decorators extends DecoratorFunction<AngularRenderer & T, any> = DecoratorFunction<
      AngularRenderer & T,
      any
    >,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      render?: ArgsStoryFn<AngularRenderer & T, TArgs & T['args']>;
    } & MetaInput<AngularRenderer & T, TArgs, Decorators, TMetaArgKeys>
  ): AngularMeta<MetaTypes<AngularRenderer & T, TArgs, Decorators, TMetaArgKeys>, TMetaArgKeys>;
}

/**
 * Angular-specific Meta interface returned by `preview.meta()`.
 *
 * Provides the `story()` method to create individual stories with proper type inference. Args
 * provided in meta become optional in stories, while missing required args must be provided at the
 * story level.
 */
export interface AngularMeta<
  T extends AngularRenderer,
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
   * // Using just a render function
   * export const CustomTemplate = meta.story(() => ({
   *   template: '<div>Custom static content</div>',
   * }));
   *
   * // Using an object with render
   * export const WithRender = meta.story({
   *   render: () => ({ template: '<my-component></my-component>' }),
   * });
   * ```
   */
  story<
    TInput extends
      | (() => AngularRenderer['storyResult'])
      | (StoryAnnotations<T, T['args']> & {
          render: () => AngularRenderer['storyResult'];
        }),
  >(
    story: TInput
  ): AngularStory<
    T,
    TInput extends () => AngularRenderer['storyResult'] ? { render: TInput } : TInput
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
  ): AngularStory<T, TInput>;

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
   * const meta = preview.meta({ component: Button, args: { label: 'Hi', disabled: false } });
   * export const Default = meta.story(); // Valid - all args provided in meta
   * ```
   */
  story(
    ..._args: Partial<T['args']> extends StoryArgs<T['args'], TMetaArgKeys> ? [] : [never]
  ): AngularStory<T, {}>;

  /**
   * Add types to the stories created from the returned meta, such as an arg that only one story
   * has: `meta.type<{ args: { icon: string } }>().story({ args: { icon: 'star' } })`.
   */
  type<S>(): AngularMeta<T & S, TMetaArgKeys>;
}

/**
 * Angular-specific Story interface returned by `meta.story()`.
 *
 * Represents a single story with its configuration and provides access to the composed story for
 * testing via `story.run()`.
 */
export interface AngularStory<
  T extends AngularRenderer,
  TInput extends StoryAnnotations<T, T['args']>,
> extends Story<T, TInput> {}

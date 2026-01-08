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

import * as vueAnnotations from './entry-preview';
import * as vueDocsAnnotations from './entry-preview-docs';
import { type Args, type ComponentPropsAndSlots } from './public-types';
import { type VueTypes } from './types';

/**
 * Creates a Vue3-specific preview configuration with CSF factories support.
 *
 * This function wraps the base `definePreview` and adds Vue3-specific annotations for rendering and
 * documentation. It returns a `VuePreview` that provides type-safe `meta()` and `story()` factory
 * methods.
 *
 * @example
 *
 * ```ts
 * // .storybook/preview.ts
 * import { definePreview } from '@storybook/vue3';
 *
 * export const preview = definePreview({
 *   addons: [],
 *   parameters: { layout: 'centered' },
 * });
 * ```
 */
export function __definePreview<Addons extends PreviewAddon<never>[]>(
  input: { addons: Addons } & ProjectAnnotations<VueTypes & InferTypes<Addons>>
): VuePreview<VueTypes & InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [vueAnnotations, vueDocsAnnotations, ...(input.addons ?? [])],
  }) as unknown as VuePreview<VueTypes & InferTypes<Addons>>;

  return preview;
}

type InferArgs<TArgs, T, Decorators> = Simplify<
  TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<VueTypes & T, Decorators>>>
>;

type InferVueTypes<T, TArgs, Decorators> = VueTypes &
  T & { args: Simplify<InferArgs<TArgs, T, Decorators>> };

/**
 * Vue3-specific Preview interface that provides type-safe CSF factory methods.
 *
 * Use `preview.meta()` to create a meta configuration for a component, and then `meta.story()` to
 * create individual stories. The type system will infer args from the component props, slots,
 * decorators, and any addon types.
 *
 * @example
 *
 * ```ts
 * const meta = preview.meta({ component: Button });
 * export const Primary = meta.story({ args: { label: 'Click me' } });
 * ```
 */
export interface VuePreview<T extends AddonTypes> extends Preview<VueTypes & T> {
  /**
   * Narrows the type of the preview to include additional type information. This is useful when you
   * need to add args that aren't inferred from the component.
   *
   * @example
   *
   * ```ts
   * const meta = preview.type<{ args: { theme: 'light' | 'dark' } }>().meta({
   *   component: Button,
   * });
   * ```
   */
  type<R>(): VuePreview<T & R>;

  meta<
    C,
    Decorators extends DecoratorFunction<VueTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<ComponentPropsAndSlots<C> & T['args']>,
  >(
    meta: {
      component?: C;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<VueTypes & T, ComponentPropsAndSlots<C> & T['args']>,
      'decorators' | 'component' | 'args'
    >
  ): VueMeta<
    InferVueTypes<T, ComponentPropsAndSlots<C>, Decorators>,
    Omit<ComponentAnnotations<InferVueTypes<T, ComponentPropsAndSlots<C>, Decorators>>, 'args'> & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;

  meta<
    TArgs extends Args,
    Decorators extends DecoratorFunction<VueTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<TArgs>,
  >(
    meta: {
      render?: ArgsStoryFn<VueTypes & T, TArgs>;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<VueTypes & T, TArgs & T['args']>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): VueMeta<
    InferVueTypes<T, TArgs, Decorators>,
    Omit<ComponentAnnotations<InferVueTypes<T, TArgs, Decorators>>, 'args'> & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;
}

/** Extracts and unions all args types from an array of decorators. */
type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

/**
 * Vue3-specific Meta interface returned by `preview.meta()`.
 *
 * Provides the `story()` method to create individual stories with proper type inference. Args
 * provided in meta become optional in stories, while missing required args must be provided at the
 * story level.
 */
export interface VueMeta<T extends VueTypes, MetaInput extends ComponentAnnotations<T>>
/**
 * @ts-expect-error VueMeta requires two type parameters to track both inferred component
 * types (T) and custom meta annotations (MetaInput), but Meta only accepts compatible params.
 */
  extends Meta<T, MetaInput> {
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
   * export const CustomRender = meta.story(() => h('div', 'Custom content'));
   *
   * // Using defineComponent
   * export const WithDefineComponent = meta.story(() =>
   *   defineComponent({
   *     template: '<div>Static component</div>',
   *   })
   * );
   * ```
   */
  story<
    TInput extends
      | (() => VueTypes['storyResult'])
      | (StoryAnnotations<T, T['args']> & {
          render: () => VueTypes['storyResult'];
        }),
  >(
    story: TInput
  ): VueStory<T, TInput extends () => VueTypes['storyResult'] ? { render: TInput } : TInput>;

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
    TInput extends Simplify<
      StoryAnnotations<
        T,
        T['args'],
        SetOptional<T['args'], keyof T['args'] & keyof MetaInput['args']>
      >
    >,
  >(
    story: TInput
  ): VueStory<T, TInput>;

  /**
   * Creates a story with no additional configuration.
   *
   * This overload is only available when all required args have been provided in meta. The
   * conditional type `Partial<T['args']> extends SetOptional<...>` checks if the remaining required
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
    ..._args: Partial<T['args']> extends SetOptional<
      T['args'],
      keyof T['args'] & keyof MetaInput['args']
    >
      ? []
      : [never]
  ): VueStory<T, {}>;
}

/**
 * Vue3-specific Story interface returned by `meta.story()`.
 *
 * Represents a single story with its configuration and provides access to the composed story for
 * testing via `story.run()`.
 */
export interface VueStory<T extends VueTypes, TInput extends StoryAnnotations<T, T['args']>>
  extends Story<T, TInput> {}

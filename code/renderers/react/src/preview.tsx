import type { ComponentType } from 'react';

import { definePreview as definePreviewBase } from 'storybook/internal/csf';
import type { AddonTypes, InferTypes, Meta, Preview, Story } from 'storybook/internal/csf';
import type { PreviewAddon } from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';

import type { RemoveIndexSignature, SetOptional, Simplify, UnionToIntersection } from 'type-fest';

import * as reactAnnotations from './entry-preview';
import * as reactArgTypesAnnotations from './entry-preview-argtypes';
import * as reactDocsAnnotations from './entry-preview-docs';
import type { AddMocks } from './public-types';
import type { ReactTypes } from './types';

/** Extracts and unions all args types from an array of decorators. */
type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

type InferArgs<TArgs, T, Decorators> = Simplify<
  TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<ReactTypes & T, Decorators>>>
>;

type InferReactTypes<T, TArgs, Decorators> = ReactTypes &
  T & { args: Simplify<InferArgs<TArgs, T, Decorators>> };

/**
 * Creates a React-specific preview configuration with CSF factories support.
 *
 * This function wraps the base `definePreview` and adds React-specific annotations for rendering
 * and documentation. It returns a `ReactPreview` that provides type-safe `meta()` and `story()`
 * factory methods.
 *
 * @example
 *
 * ```ts
 * // .storybook/preview.ts
 * import { definePreview } from '@storybook/react';
 *
 * export const preview = definePreview({
 *   addons: [],
 *   parameters: { layout: 'centered' },
 * });
 * ```
 */
export function __definePreview<Addons extends PreviewAddon<never>[]>(
  input: { addons: Addons } & ProjectAnnotations<ReactTypes & InferTypes<Addons>>
): ReactPreview<ReactTypes & InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [
      reactAnnotations,
      reactArgTypesAnnotations,
      reactDocsAnnotations,
      ...(input.addons ?? []),
    ],
  }) as unknown as ReactPreview<ReactTypes & InferTypes<Addons>>;

  const defineMeta = preview.meta.bind(preview);
  preview.meta = (_input) => {
    const meta = defineMeta(_input);
    const defineStory = meta.story.bind(meta);
    // @ts-expect-error internal code that is hard to type
    meta.story = (__input: any) => {
      const story = defineStory(__input);
      // TODO: [test-syntax] Are we sure we want this? the Component construct was for
      // compatibility with raw portable stories. We don't actually use this in vitest.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore this is a private property used only here
      story.Component = story.__compose();
      return story;
    };
    return meta;
  };
  return preview;
}

/**
 * React-specific Preview interface that provides type-safe CSF factory methods.
 *
 * Use `preview.meta()` to create a meta configuration for a component, and then `meta.story()` to
 * create individual stories. The type system will infer args from the component props, decorators,
 * and any addon types.
 *
 * @example
 *
 * ```ts
 * const meta = preview.meta({ component: Button });
 * export const Primary = meta.story({ args: { label: 'Click me' } });
 * ```
 */
/** @ts-expect-error We cannot implement the meta faithfully here, but that is okay. */
export interface ReactPreview<T extends AddonTypes> extends Preview<ReactTypes & T> {
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
  type<R>(): ReactPreview<T & R>;

  meta<
    TArgs extends Args,
    Decorators extends DecoratorFunction<ReactTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<TArgs & T['args']>,
  >(
    meta: {
      render?: ArgsStoryFn<ReactTypes & T, TArgs & T['args']>;
      component?: ComponentType<TArgs>;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<
      ComponentAnnotations<ReactTypes & T, TArgs>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): ReactMeta<
    InferReactTypes<T, TArgs, Decorators>,
    Omit<ComponentAnnotations<InferReactTypes<T, TArgs, Decorators>>, 'args'> & {
      args: Partial<TArgs> extends TMetaArgs ? {} : TMetaArgs;
    }
  >;
}

/**
 * React-specific Meta interface returned by `preview.meta()`.
 *
 * Provides the `story()` method to create individual stories with proper type inference. Args
 * provided in meta become optional in stories, while missing required args must be provided at the
 * story level.
 */
export interface ReactMeta<T extends ReactTypes, MetaInput extends ComponentAnnotations<T>>
  // @ts-expect-error ReactMeta requires two type parameters, but Meta's constraints differ
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
   * export const CustomRender = meta.story(() => <div>Custom content</div>);
   *
   * // Using an object with render
   * export const WithRender = meta.story({
   *   render: () => <MyComponent prop="static" />,
   * });
   * ```
   */
  story<
    TInput extends
      | (() => ReactTypes['storyResult'])
      | (StoryAnnotations<T, T['args']> & {
          render: () => ReactTypes['storyResult'];
        }),
  >(
    story: TInput
  ): ReactStory<T, TInput extends () => ReactTypes['storyResult'] ? { render: TInput } : TInput>;

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
        // TODO: infer mocks from story itself as well
        AddMocks<T['args'], MetaInput['args']>,
        SetOptional<T['args'], keyof T['args'] & keyof MetaInput['args']>
      >
    >,
  >(
    story: TInput
    /** @ts-expect-error hard */
  ): ReactStory<T, TInput>;

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
  ): ReactStory<T, {}>;
}

/**
 * React-specific Story interface returned by `meta.story()`.
 *
 * Represents a single story with its configuration and provides access to the composed story for
 * testing via `story.run()`.
 *
 * Also includes a `Component` property for portable story compatibility.
 */
export interface ReactStory<T extends ReactTypes, TInput extends StoryAnnotations<T, T['args']>>
  extends Story<T, TInput> {
  Component: ComponentType<Partial<T['args']>>;
}

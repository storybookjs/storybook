import type { ComponentType } from 'react';

import type { AddonTypes, InferTypes, PreviewAddon } from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';
import type { RemoveIndexSignature, Simplify, UnionToIntersection } from 'type-fest';
import type { AnyRoute, FileRoutesByPath } from '@tanstack/react-router';

import type { ReactMeta, ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactTypes } from '@storybook/react';

import * as tanstackPreview from './preview';
import type { TanStackTypes } from './types';
import type { IsRoute } from './routing/types';
import type { ReactRenderer } from '@storybook/react';

import type { StoryObj as _StoryObj, Meta as _Meta } from '@storybook/react';
export * from '@storybook/react';
export * from './types';
export type {
  CreateStoryRouteOptions,
  IsRoute,
  StoryRouteFileOptions,
  StoryRouteOptions,
  RouterParameters,
} from './routing/types';

// -- Helper types replicating private types from @storybook/react --

/** Extracts and unions all args types from an array of decorators. */
type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

type InferCombinedTypes<T, TArgs, Decorators> = ReactTypes &
  T & {
    args: Simplify<
      TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<ReactTypes & T, Decorators>>>
    >;
  };

// -------

export type Preview<TRoute extends AnyRoute | undefined = undefined> = ProjectAnnotations<
  ReactTypes & TanStackTypes<TRoute>
>;

export function definePreview<
  TRoute extends AnyRoute | undefined = undefined,
  Addons extends PreviewAddon<never>[] = [],
>(
  preview: {
    addons?: Addons;
    route?: TRoute;
  } & ProjectAnnotations<ReactTypes & TanStackTypes<NoInfer<TRoute>> & InferTypes<Addons>>
): TanStackPreview<InferTypes<Addons>, TRoute> {
  // @ts-expect-error passing through addons
  return __definePreview({
    ...preview,
    addons: [tanstackPreview, ...(preview.addons ?? [])],
  });
}

/**
 * Metadata to configure stories for a component or a TanStack Route.
 *
 * When `TCmpOrArgs` is a TanStack Route, the `component` field accepts the
 * Route object directly and TanStack parameters (params, query, loader, etc.)
 * are inferred from the route's types.
 */
export type Meta<TCmpOrArgs = Args> =
  IsRoute<TCmpOrArgs> extends true
    ? Omit<ComponentAnnotations<ReactRenderer, Args>, 'component'> &
        Partial<TanStackTypes<TCmpOrArgs>>
    : _Meta<TCmpOrArgs>;

/**
 * When the meta's `component` is a TanStack Route, the story inherits
 * TanStack parameter types for type-safe params/query/loader configuration.
 */
export type StoryObj<TMetaOrCmpOrArgs = unknown> = [TMetaOrCmpOrArgs] extends [
  { component?: infer Component },
]
  ? IsRoute<Component> extends true
    ? StoryAnnotations<ReactRenderer, Args, Partial<Args>> & Partial<TanStackTypes<Component>>
    : _StoryObj<TMetaOrCmpOrArgs> & Partial<TanStackTypes>
  : IsRoute<TMetaOrCmpOrArgs> extends true
    ? StoryAnnotations<ReactRenderer, Args, Partial<Args>> &
        Partial<TanStackTypes<TMetaOrCmpOrArgs>>
    : _StoryObj<TMetaOrCmpOrArgs> & Partial<TanStackTypes>;

interface TanStackPreview<
  T extends AddonTypes,
  TRoute extends AnyRoute | undefined = undefined,
> extends ReactPreview<TanStackTypes<TRoute> & T> {
  type<R>(): TanStackPreview<T & R, TRoute>;

  // Overload 1: with route — infers TMetaRoute from the provided route
  meta<
    TMetaRoute extends AnyRoute,
    TArgs extends Args,
    Decorators extends DecoratorFunction<ReactTypes & TanStackTypes<TMetaRoute> & T, any>,
    TMetaArgs extends Partial<TArgs & (TanStackTypes<TMetaRoute> & T)['args']>,
  >(
    meta: {
      render?: ArgsStoryFn<
        ReactTypes & TanStackTypes<TMetaRoute> & T,
        TArgs & (TanStackTypes<TMetaRoute> & T)['args']
      >;
      component?: ComponentType<TArgs>;
      /** Provide a route to enable type-safe params/query/loader inference for this meta. */
      route: TMetaRoute;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<
      ComponentAnnotations<ReactTypes & TanStackTypes<TMetaRoute> & T, TArgs>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): ReactMeta<
    InferCombinedTypes<TanStackTypes<TMetaRoute> & T, TArgs, Decorators>,
    Omit<
      ComponentAnnotations<InferCombinedTypes<TanStackTypes<TMetaRoute> & T, TArgs, Decorators>>,
      'args'
    > & {
      args: Partial<TArgs> extends TMetaArgs ? {} : TMetaArgs;
    }
  >;

  // Overload 2: component is a Route — infers route type from the component itself
  meta<
    TMetaRoute extends AnyRoute | FileRoutesByPath[keyof FileRoutesByPath],
    TArgs extends Args,
    Decorators extends DecoratorFunction<ReactTypes & TanStackTypes<TMetaRoute> & T, any>,
    TMetaArgs extends Partial<TArgs & (TanStackTypes<TMetaRoute> & T)['args']>,
  >(
    meta: {
      render?: ArgsStoryFn<
        ReactTypes & TanStackTypes<TMetaRoute> & T,
        TArgs & (TanStackTypes<TMetaRoute> & T)['args']
      >;
      component: TMetaRoute;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<
      ComponentAnnotations<ReactTypes & TanStackTypes<TMetaRoute> & T, TArgs>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): ReactMeta<
    InferCombinedTypes<TanStackTypes<TMetaRoute> & T, TArgs, Decorators>,
    Omit<
      ComponentAnnotations<InferCombinedTypes<TanStackTypes<TMetaRoute> & T, TArgs, Decorators>>,
      'args'
    > & {
      args: Partial<TArgs> extends TMetaArgs ? {} : TMetaArgs;
    }
  >;

  // Overload 3: without route — uses the preview-level TRoute
  meta<
    TArgs extends Args,
    Decorators extends DecoratorFunction<ReactTypes & TanStackTypes<TRoute> & T, any>,
    TMetaArgs extends Partial<TArgs & (TanStackTypes<TRoute> & T)['args']>,
  >(
    meta: {
      render?: ArgsStoryFn<
        ReactTypes & TanStackTypes<TRoute> & T,
        TArgs & (TanStackTypes<TRoute> & T)['args']
      >;
      component?: ComponentType<TArgs>;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<
      ComponentAnnotations<ReactTypes & TanStackTypes<TRoute> & T, TArgs>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): ReactMeta<
    InferCombinedTypes<TanStackTypes<TRoute> & T, TArgs, Decorators>,
    Omit<
      ComponentAnnotations<InferCombinedTypes<TanStackTypes<TRoute> & T, TArgs, Decorators>>,
      'args'
    > & {
      args: Partial<TArgs> extends TMetaArgs ? {} : TMetaArgs;
    }
  >;
}

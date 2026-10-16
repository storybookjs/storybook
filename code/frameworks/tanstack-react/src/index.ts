import type { ComponentType } from 'react';

import type {
  AddonTypes,
  InferTypes,
  MetaInput,
  MetaTypes,
  PreviewAddon,
  PreviewAddonEntry,
} from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  Parameters,
  ProjectAnnotations,
  StoryAnnotations,
} from 'storybook/internal/types';
import type { AnyRoute, FileRoutesByPath } from '@tanstack/react-router';

import type { ReactMeta, ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactTypes } from '@storybook/react';

import * as tanstackPreview from './preview.tsx';
import type { DefaultStoryPath, TanStackParameters, TanStackTypes } from './types.ts';
import type { IsRoute } from './routing/types.ts';
import type { ReactRenderer } from '@storybook/react';

import type { StoryObj as _StoryObj, Meta as _Meta } from '@storybook/react';
export * from '@storybook/react';
export * from './types.ts';
export type {
  CreateStoryRouteOptions,
  IsRoute,
  StoryRouteFileOptions,
  StoryRouteOptions,
  RouterParameters,
} from './routing/types.ts';

export type Preview<TRoute extends AnyRoute | undefined = undefined> = ProjectAnnotations<
  ReactTypes & TanStackTypes<TRoute>
>;

export function definePreview<
  TRoute extends AnyRoute | undefined = undefined,
  const TPath extends DefaultStoryPath<TRoute> = DefaultStoryPath<TRoute>,
  Addons extends PreviewAddonEntry[] = [],
>(
  preview: {
    addons?: Addons;
    route?: TRoute;
  } & ProjectAnnotations<ReactTypes & TanStackTypes<NoInfer<TRoute>, TPath> & InferTypes<Addons>>
): TanStackPreview<InferTypes<Addons>, TRoute> {
  return __definePreview({
    ...preview,
    addons: [tanstackPreview, ...(preview.addons ?? [])] as PreviewAddon<
      TanStackTypes<TRoute, TPath> & InferTypes<Addons>
    >[],
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

export interface TanStackPreview<
  T extends AddonTypes,
  TRoute extends AnyRoute | undefined = undefined,
> extends ReactPreview<TanStackTypes<TRoute> & T> {
  type<R>(): TanStackPreview<T & R, TRoute>;

  // Overload 1: with route — infers TMetaRoute from the provided route
  meta<
    TMetaRoute extends AnyRoute,
    const TPath extends DefaultStoryPath<TMetaRoute> = DefaultStoryPath<TMetaRoute>,
    TArgs extends Args = Args,
    Decorators extends DecoratorFunction<ReactTypes & TanStackTypes<TMetaRoute, TPath> & T, any> =
      DecoratorFunction<ReactTypes & TanStackTypes<TMetaRoute, TPath> & T, any>,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      render?: ArgsStoryFn<
        ReactTypes & TanStackTypes<TMetaRoute, TPath> & T,
        TArgs & (TanStackTypes<TMetaRoute, TPath> & T)['args']
      >;
      component?: ComponentType<TArgs>;
      parameters?: TanStackParameters<TMetaRoute, TPath> &
        Parameters &
        (ReactTypes & T)['parameters'];
    } & MetaInput<
      ReactTypes & TanStackTypes<TMetaRoute, TPath> & T,
      TArgs,
      Decorators,
      TMetaArgKeys
    >
  ): ReactMeta<
    MetaTypes<ReactTypes & TanStackTypes<TMetaRoute, TPath> & T, TArgs, Decorators, TMetaArgKeys>,
    TMetaArgKeys
  >;

  // Overload 2: without route — uses the preview-level TRoute
  meta<
    const TPath extends DefaultStoryPath<TRoute> = DefaultStoryPath<TRoute>,
    TArgs extends Args = Args,
    Decorators extends DecoratorFunction<ReactTypes & TanStackTypes<TRoute, TPath> & T, any> =
      DecoratorFunction<ReactTypes & TanStackTypes<TRoute, TPath> & T, any>,
    TMetaArgKeys extends PropertyKey = never,
  >(
    meta: {
      render?: ArgsStoryFn<
        ReactTypes & TanStackTypes<TRoute, TPath> & T,
        TArgs & (TanStackTypes<TRoute, TPath> & T)['args']
      >;
      component?: ComponentType<TArgs>;
      parameters?: TanStackParameters<TRoute, TPath> & Parameters & (ReactTypes & T)['parameters'];
    } & MetaInput<ReactTypes & TanStackTypes<TRoute, TPath> & T, TArgs, Decorators, TMetaArgKeys>
  ): ReactMeta<
    MetaTypes<ReactTypes & TanStackTypes<TRoute, TPath> & T, TArgs, Decorators, TMetaArgKeys>,
    TMetaArgKeys
  >;
}

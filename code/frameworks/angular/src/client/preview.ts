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

import * as angularAnnotations from './config';
import * as angularDocsAnnotations from './docs/config';
import type { TransformComponentType } from './public-types';
import { type AngularRenderer } from './types';

export function __definePreview<Addons extends PreviewAddon<never>[]>(
  input: { addons: Addons } & ProjectAnnotations<AngularRenderer & InferTypes<Addons>>
): AngularPreview<AngularRenderer & InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [angularAnnotations, angularDocsAnnotations, ...(input.addons ?? [])],
  }) as unknown as AngularPreview<AngularRenderer & InferTypes<Addons>>;

  return preview;
}

type InferArgs<TArgs, T, Decorators> = Simplify<
  TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<AngularRenderer & T, Decorators>>>
>;

type InferComponentArgs<C extends abstract new (...args: any) => any> = Partial<
  TransformComponentType<InstanceType<C>>
>;

type InferAngularTypes<T, TArgs, Decorators> = AngularRenderer &
  T & { args: Simplify<InferArgs<TArgs, T, Decorators>> };

export interface AngularPreview<T extends AddonTypes> extends Preview<AngularRenderer & T> {
  type<S>(): AngularPreview<T & S>;

  meta<
    C extends abstract new (...args: any) => any,
    Decorators extends DecoratorFunction<AngularRenderer & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<InstanceType<C> & T['args']>,
  >(
    meta: {
      component?: C;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<AngularRenderer & T, InferComponentArgs<C> & T['args']>,
      'decorators' | 'component' | 'args'
    >
  ): AngularMeta<
    InferAngularTypes<T, InferComponentArgs<C>, Decorators>,
    Omit<ComponentAnnotations<InferAngularTypes<T, InferComponentArgs<C>, Decorators>>, 'args'> & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;

  meta<
    TArgs,
    Decorators extends DecoratorFunction<AngularRenderer & T, any>,
    TMetaArgs extends Partial<TArgs & T['args']>,
  >(
    meta: {
      render?: ArgsStoryFn<AngularRenderer & T, TArgs & T['args']>;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<AngularRenderer & T, TArgs & T['args']>,
      'decorators' | 'args' | 'render' | 'component'
    >
  ): AngularMeta<
    InferAngularTypes<T, TArgs, Decorators>,
    Omit<ComponentAnnotations<InferAngularTypes<T, TArgs, Decorators>>, 'args'> & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;
}

type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

export interface AngularMeta<T extends AngularRenderer, MetaInput extends ComponentAnnotations<T>>
  extends Meta<T, MetaInput> {
  // meta.story(() => ({ template: '<div></div>' }))
  story<
    TInput extends
      | (() => AngularRenderer['storyResult'])
      // Required args don't need to be provided when the user uses an empty render
      | (StoryAnnotations<T, T['args']> & {
          render: () => AngularRenderer['storyResult'];
        }),
  >(
    story: TInput
  ): AngularStory<
    T,
    TInput extends () => AngularRenderer['storyResult'] ? { render: TInput } : TInput
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
  ): AngularStory<T, TInput>;

  // meta.story()
  story(
    ..._args: Partial<T['args']> extends SetOptional<
      T['args'],
      keyof T['args'] & keyof MetaInput['args']
    >
      ? []
      : [never]
  ): AngularStory<T, {}>;
}

export interface AngularStory<
  T extends AngularRenderer,
  TInput extends StoryAnnotations<T, T['args']>,
> extends Story<T, TInput> {}

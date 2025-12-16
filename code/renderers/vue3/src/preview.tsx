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
import { type Args, ComponentPropsAndSlots } from './public-types';
import { VueTypes } from './types';

export function __definePreview<Addons extends PreviewAddon<never>[]>(
  input: { addons: Addons } & ProjectAnnotations<VueTypes & InferTypes<Addons>>
): VuePreview<VueTypes & InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [vueAnnotations, vueDocsAnnotations, ...(input.addons ?? [])],
  }) as unknown as VuePreview<VueTypes & InferTypes<Addons>>;

  return preview;
}

type InferArgs<C, T, Decorators> = Simplify<
  ComponentPropsAndSlots<C> &
    Simplify<RemoveIndexSignature<DecoratorsArgs<VueTypes & T, Decorators>>>
>;

export interface VuePreview<T extends AddonTypes> extends Preview<VueTypes & T> {
  meta<
    C,
    Decorators extends DecoratorFunction<VueTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<ComponentPropsAndSlots<C>>,
  >(
    meta: {
      component?: C;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<VueTypes & T, ComponentPropsAndSlots<C>>,
      'decorators' | 'component' | 'args'
    >
  ): VueMeta<
    VueTypes & T & { args: InferArgs<C, T, Decorators> },
    Omit<ComponentAnnotations<VueTypes & T & { args: InferArgs<C, T, Decorators> }>, 'args'> & {
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
    } & Omit<ComponentAnnotations<VueTypes & T, TArgs>, 'decorators' | 'args' | 'render'>
  ): VueMeta<
    VueTypes &
      T & {
        args: Simplify<
          TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<VueTypes & T, Decorators>>>
        >;
      },
    Omit<
      ComponentAnnotations<
        VueTypes &
          T & {
            args: Simplify<
              TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<VueTypes & T, Decorators>>>
            >;
          }
      >,
      'args'
    > & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;
}

type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

export interface VueMeta<T extends VueTypes, MetaInput extends ComponentAnnotations<T>>
/** @ts-expect-error hard */
  extends Meta<T, MetaInput> {
  // Required args don't need to be provided when the user uses an empty render
  story<
    TInput extends
      | (() => VueTypes['storyResult'])
      | (StoryAnnotations<T, T['args']> & {
          render: () => VueTypes['storyResult'];
        }),
  >(
    story: TInput
  ): VueStory<T, TInput extends () => VueTypes['storyResult'] ? { render: TInput } : TInput>;

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

  story(
    ..._args: Partial<T['args']> extends SetOptional<
      T['args'],
      keyof T['args'] & keyof MetaInput['args']
    >
      ? []
      : [never]
  ): VueStory<T, {}>;
}

export interface VueStory<T extends VueTypes, TInput extends StoryAnnotations<T, T['args']>>
  extends Story<T, TInput> {}

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
import { ComponentProps } from 'vue-component-type-helpers';

import * as vueAnnotations from './entry-preview';
import * as vueDocsAnnotations from './entry-preview-docs';
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

/** @ts-expect-error We cannot implement the meta faithfully here, but that is okay. */
export interface VuePreview<T extends AddonTypes> extends Preview<VueTypes & T> {
  meta<
    C,
    Decorators extends DecoratorFunction<VueTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<ComponentProps<C>>,
  >(
    meta: {
      render?: ArgsStoryFn<VueTypes & T, ComponentProps<C>>;
      component?: C;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<
      ComponentAnnotations<VueTypes & T, ComponentProps<C>>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): VueMeta<
    VueTypes &
      T & {
        args: Simplify<
          ComponentProps<C> &
            Simplify<RemoveIndexSignature<DecoratorsArgs<VueTypes & T, Decorators>>>
        >;
      },
    Omit<
      ComponentAnnotations<
        VueTypes &
          T & {
            args: Simplify<
              ComponentProps<C> &
                Simplify<RemoveIndexSignature<DecoratorsArgs<VueTypes & T, Decorators>>>
            >;
          }
      >,
      'args'
    > & {
      args: Partial<ComponentProps<C>> extends TMetaArgs ? {} : TMetaArgs;
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

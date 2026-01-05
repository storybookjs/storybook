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

// @ts-expect-error Hard
export interface WebComponentsPreview<T extends AddonTypes>
  extends Preview<WebComponentsTypes & T> {
  type<S>(): WebComponentsPreview<T & S>;

  meta<
    TArgs,
    Decorators extends DecoratorFunction<WebComponentsTypes & T, any>,
    TMetaArgs extends Partial<T['args']>,
  >(
    meta: {
      render?: ArgsStoryFn<WebComponentsTypes & T, TArgs & T['args']>;
      args?: TMetaArgs;
      decorators?: Decorators | Decorators[];
    } & Omit<
      ComponentAnnotations<WebComponentsTypes & T, TArgs & T['args']>,
      'decorators' | 'args' | 'render'
    >
  ): WebComponentsMeta<
    InferWebComponentsTypes<T, TArgs, Decorators>,
    Omit<ComponentAnnotations<InferWebComponentsTypes<T, TArgs, Decorators>>, 'args'> & {
      args: {} extends TMetaArgs ? {} : TMetaArgs;
    }
  >;
}

type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

export interface WebComponentsMeta<
  T extends WebComponentsTypes,
  MetaInput extends ComponentAnnotations<T>,
  /** @ts-expect-error hard */
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

  // meta.story()
  story(
    ..._args: Partial<T['args']> extends SetOptional<
      T['args'],
      keyof T['args'] & keyof MetaInput['args']
    >
      ? []
      : [never]
  ): WebComponentsStory<T, {}>;
}

export interface WebComponentsStory<
  T extends WebComponentsTypes,
  TInput extends StoryAnnotations<T, T['args']>,
> extends Story<T, TInput> {}

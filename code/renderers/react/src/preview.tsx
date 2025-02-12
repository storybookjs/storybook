import type { ComponentType } from 'react';

import { definePreview as definePreviewBase } from 'storybook/internal/csf';
import type { InferTypes, Meta, Preview, Story, Types } from 'storybook/internal/csf';
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

import type { AddMocks } from 'src/public-types';
import type { RemoveIndexSignature, SetOptional, Simplify, UnionToIntersection } from 'type-fest';

import * as reactAnnotations from './entry-preview';
import * as reactDocsAnnotations from './entry-preview-docs';
import type { ReactRenderer } from './types';

export function definePreview<Addons extends PreviewAddon<never>[]>(
  preview: ProjectAnnotations<ReactRenderer> & { addons?: Addons }
): ReactPreview<InferTypes<Addons>> {
  return definePreviewBase({
    ...preview,
    addons: [reactAnnotations, reactDocsAnnotations, ...(preview.addons ?? [])],
  }) as unknown as ReactPreview<InferTypes<Addons>>;
}

// @ts-expect-error hard
export interface ReactPreview<T extends Types> extends Preview<ReactRenderer & T> {
  meta<
    TArgs extends Args,
    Decorators extends DecoratorFunction<ReactRenderer & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<TArgs>,
  >(
    meta: {
      render?: ArgsStoryFn<ReactRenderer & T, TArgs>;
      component?: ComponentType<TArgs>;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<ComponentAnnotations<ReactRenderer & T, TArgs>, 'decorators'>
  ): ReactMeta<
    {
      args: Simplify<
        TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<ReactRenderer & T, Decorators>>>
      >;
    },
    { args: Partial<TArgs> extends TMetaArgs ? {} : TMetaArgs }
  >;
}

type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;
interface ReactMeta<
  Context extends { args: Args },
  MetaInput extends ComponentAnnotations<ReactRenderer>,
> extends Meta<ReactRenderer, Context['args']> {
  story<
    const TInput extends Simplify<
      StoryAnnotations<
        ReactRenderer,
        // TODO: infer mocks from story itself as well
        AddMocks<Context['args'], MetaInput['args']>,
        SetOptional<Context['args'], keyof Context['args'] & keyof MetaInput['args']>
      >
    >,
  >(
    story: TInput
  ): ReactStory;
}

interface ReactStory extends Story<ReactRenderer> {}

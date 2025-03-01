/* eslint-disable no-underscore-dangle,@typescript-eslint/naming-convention */
import type { ComponentType } from 'react';

import { __definePreview as definePreviewBase } from 'storybook/internal/csf';
import type { Meta, Preview, Story } from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';

import type { RemoveIndexSignature, SetOptional, Simplify, UnionToIntersection } from 'type-fest';

import * as reactAnnotations from './entry-preview';
import * as reactDocsAnnotations from './entry-preview-docs';
import type { AddMocks } from './public-types';
import type { ReactRenderer } from './types';

/** Do not use, use the definePreview exported from the framework instead */
export function __definePreview(preview: ReactPreview['input']) {
  return definePreviewBase({
    ...preview,
    addons: [reactAnnotations, reactDocsAnnotations, ...(preview.addons ?? [])],
  }) as ReactPreview;
}

export interface ReactPreview extends Preview<ReactRenderer> {
  meta<
    TArgs extends Args,
    Decorators extends DecoratorFunction<ReactRenderer, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<TArgs>,
  >(
    meta: {
      render?: ArgsStoryFn<ReactRenderer, TArgs>;
      component?: ComponentType<TArgs>;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<ComponentAnnotations<ReactRenderer, TArgs>, 'decorators'>
  ): ReactMeta<
    {
      args: Simplify<
        TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<ReactRenderer, Decorators>>>
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
    TInput extends StoryAnnotations<ReactRenderer, Context['args']> & {
      render: () => ReactRenderer['storyResult'];
    },
  >(
    story: TInput
  ): ReactStory;

  story<
    TInput extends Simplify<
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

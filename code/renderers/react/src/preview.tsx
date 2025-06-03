import type { ComponentType } from 'react';

import { definePreview as definePreviewBase } from 'storybook/internal/csf';
import type { AddonTypes, InferTypes, Meta, Preview, Story } from 'storybook/internal/csf';
import type { PreviewAddon } from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  NormalizedStoryAnnotations,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';

import type { RemoveIndexSignature, SetOptional, Simplify, UnionToIntersection } from 'type-fest';

import * as reactAnnotations from './entry-preview';
import * as reactArgTypesAnnotations from './entry-preview-argtypes';
import * as reactDocsAnnotations from './entry-preview-docs';
import type { AddMocks } from './public-types';
import type { ReactRenderer } from './types';

export function __definePreview<Addons extends PreviewAddon<never>[]>(
  input: ProjectAnnotations<ReactRenderer> & { addons: Addons }
): ReactPreview<InferTypes<Addons>> {
  const preview = definePreviewBase({
    ...input,
    addons: [
      reactAnnotations,
      reactArgTypesAnnotations,
      reactDocsAnnotations,
      ...(input.addons ?? []),
    ],
  }) as unknown as ReactPreview<InferTypes<Addons>>;

  const defineMeta = preview.meta.bind(preview);
  preview.meta = (_input) => {
    const meta = defineMeta(_input);
    const defineStory = meta.story.bind(meta);
    meta.story = (__input: any) => {
      const story = defineStory(__input);
      story.Component = story.__compose();
      return story;
    };
    return meta;
  };
  return preview;
}

export interface ReactPreview<T extends AddonTypes> extends Preview<ReactRenderer & T> {
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
    ReactRenderer &
      T & {
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

interface ReactMeta<T extends ReactRenderer, MetaInput extends ComponentAnnotations<T>>
  extends Meta<T> {
  // Required args don't need to be provided when the user uses an empty render
  story<
    TInput extends StoryAnnotations<T, T['args']> & {
      render: () => ReactRenderer['storyResult'];
    },
  >(
    story?: TInput
  ): ReactStory<T, TInput>;

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
    story?: TInput
    // @ts-expect-error fix
  ): ReactStory<T, TInput>;
}

export interface ReactStory<T extends ReactRenderer, TInput extends StoryAnnotations<T, T['args']>>
  extends Story<T, TInput> {
  Component: ComponentType<Partial<T['args']>>;
}

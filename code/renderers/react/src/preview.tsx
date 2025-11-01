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

import type { OmitIndexSignature, SetOptional, Simplify, UnionToIntersection } from 'type-fest';

import * as reactAnnotations from './entry-preview';
import * as reactArgTypesAnnotations from './entry-preview-argtypes';
import * as reactDocsAnnotations from './entry-preview-docs';
import type { AddMocks } from './public-types';
import type { ReactTypes } from './types';

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

/** @ts-expect-error We cannot implement the meta faithfully here, but that is okay. */
export interface ReactPreview<T extends AddonTypes> extends Preview<ReactTypes & T> {
  meta<
    TArgs extends Args,
    Decorators extends DecoratorFunction<ReactTypes & T, any>,
    // Try to make Exact<Partial<TArgs>, TMetaArgs> work
    TMetaArgs extends Partial<TArgs>,
  >(
    meta: {
      render?: ArgsStoryFn<ReactTypes & T, TArgs>;
      component?: ComponentType<TArgs>;
      decorators?: Decorators | Decorators[];
      args?: TMetaArgs;
    } & Omit<
      ComponentAnnotations<ReactTypes & T, TArgs>,
      'decorators' | 'component' | 'args' | 'render'
    >
  ): ReactMeta<
    ReactTypes &
      T & {
        args: Simplify<
          TArgs & Simplify<OmitIndexSignature<DecoratorsArgs<ReactTypes & T, Decorators>>>
        >;
      },
    { args: Partial<TArgs> extends TMetaArgs ? {} : TMetaArgs }
  >;
}

type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

interface ReactMeta<T extends ReactTypes, MetaInput extends ComponentAnnotations<T>>
/** @ts-expect-error hard */
  extends Meta<T, MetaInput> {
  // Required args don't need to be provided when the user uses an empty render
  story<
    TInput extends
      | (() => ReactTypes['storyResult'])
      | (StoryAnnotations<T, T['args']> & {
          render: () => ReactTypes['storyResult'];
        }),
  >(
    story?: TInput
  ): ReactStory<T, TInput extends () => ReactTypes['storyResult'] ? { render: TInput } : TInput>;

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
    /** @ts-expect-error hard */
  ): ReactStory<T, TInput>;
}

export interface ReactStory<T extends ReactTypes, TInput extends StoryAnnotations<T, T['args']>>
  extends Story<T, TInput> {
  Component: ComponentType<Partial<T['args']>>;
}

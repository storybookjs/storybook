/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ComponentAnnotations as BaseComponentAnnotations,
  StoryAnnotations as BaseStoryAnnotations,
  StoryContext as BaseStoryContext,
  WebRenderer,
} from 'storybook/internal/types';
import type { Component, ComponentProps } from 'svelte';

export type Cmp = Component<any>;

export type ComponentAnnotations<
  TCmp extends Cmp,
  TArgs extends Record<string, any> = Record<string, any>,
> = BaseComponentAnnotations<
  // 👇 Renderer
  SvelteRenderer<TCmp>,
  // 👇 Args
  TArgs
>;

export interface SvelteRenderer<TCmp extends Cmp> extends WebRenderer {
  component: TCmp;
  storyResult: SvelteStoryResult<TCmp>;
}

export interface SvelteStoryResult<TCmp extends Cmp> {
  Component?: TCmp;
  props?: ComponentProps<TCmp>;
  decorator?: TCmp;
}

export type StoryContext<TArgs extends Record<string, any>> = BaseStoryContext<
  // Renderer
  SvelteRenderer<Component<TArgs>>,
  // Args
  TArgs
>;

export type StoryAnnotations<
  TArgs extends Record<string, any>,
  TCmp extends Cmp,
> = BaseStoryAnnotations<
  // 👇 Renderer
  SvelteRenderer<TCmp>,
  // 👇 All of the args - combining the component props and the ones from meta - defineMeta
  TArgs,
  // NOTE: 👇 This is supposed to set all of the args specified in 'defineMeta' to be optional for Story
  // Partial<Simplify<SetOptional<ComponentProps<TCmp>, keyof Meta<TCmp>['args']>>>
  Partial<TArgs>
>;

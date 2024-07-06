import type { ComponentType, JSX } from 'preact';
import type { WebRenderer } from 'storybook/internal/types';

export type { RenderContext, StoryContext } from 'storybook/internal/types';

export interface PreactRenderer extends WebRenderer {
  component: ComponentType<this['T']>;
  storyResult: StoryFnPreactReturnType;
}

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export type StoryFnPreactReturnType = JSX.Element;

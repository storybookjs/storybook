import type { StoryContext as StoryContextBase, WebRenderer } from 'storybook/internal/types';
import type { TemplateResult, SVGTemplateResult } from 'lit';

export type StoryFnHtmlReturnType =
  | string
  | Node
  | DocumentFragment
  | TemplateResult
  | SVGTemplateResult;

export type StoryContext = StoryContextBase<WebComponentsRenderer>;

export interface WebComponentsRenderer extends WebRenderer {
  component: string;
  storyResult: StoryFnHtmlReturnType;
}

export interface ShowErrorArgs {
  title: string;
  description: string;
}

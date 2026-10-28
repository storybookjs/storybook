import type { StoryContext as StoryContextBase, WebRenderer } from 'storybook/internal/types';

import type { SVGTemplateResult, TemplateResult } from 'lit';

export type WebComponentsFrameworkOptions = {
  /**
   * Paths to Custom Elements Manifest files, relative to the Storybook config directory.
   *
   * When omitted, Storybook reads `customElements` from the nearest `package.json`.
   * Tags no manifest declares are generated from the project's sources.
   *
   * Please note that the runtime `setCustomElementsManifest` path is deprecated and will be removed in Storybook 12.
   */
  customElementsManifest?: string | string[];
};

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

export interface WebComponentsTypes extends WebComponentsRenderer {}

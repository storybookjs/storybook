import type { StoryContext as StoryContextBase, WebRenderer } from 'storybook/internal/types';

import type { SVGTemplateResult, TemplateResult } from 'lit';

export type WebComponentsFrameworkOptions = {
  /**
   * Paths to Custom Elements Manifest files, relative to the Storybook config directory.
   *
   * When omitted, Storybook reads `customElements` from the nearest `package.json`.
   * When neither is available, server-side docgen is skipped and the runtime `setCustomElementsManifest` path keeps working as before.
   *
   * Please note that the runtime `setCustomElementsManifest` path is deprecated and will be removed in next major.
   */
  customElementsManifest?: string | string[];
  docgen?: {
    /** Manifest key that holds analyzer-resolved type text; defaults to `parsedType`. */
    typeProperty?: string;
  };
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

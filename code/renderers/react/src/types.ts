import type { ComponentType, JSX } from 'react';

import type { Canvas, WebRenderer } from 'storybook/internal/types';

export type { RenderContext, StoryContext } from 'storybook/internal/types';

export interface ReactRenderer extends WebRenderer {
  component: ComponentType<this['T']>;
  storyResult: StoryFnReactReturnType;
  mount: (ui?: JSX.Element) => Promise<Canvas>;
}

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export interface ReactParameters {
  /** React renderer configuration */
  react?: {
    /**
     * Whether to enable React Server Components
     *
     * @see https://storybook.js.org/docs/get-started/frameworks/nextjs#react-server-components-rsc
     */
    rsc?: boolean;
    /** Options passed to React root creation */
    rootOptions?: {
      /** Custom error handler for caught errors */
      onCaughtError?: (error: unknown) => void;
    };
  };
}

export type StoryFnReactReturnType = JSX.Element;

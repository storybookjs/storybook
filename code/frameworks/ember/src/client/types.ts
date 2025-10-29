import type { StoryContext as DefaultStoryContext, WebRenderer } from 'storybook/internal/types';

import type Application from '@ember/application';

export type { RenderContext } from 'storybook/internal/types';

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export interface EmberRenderer extends WebRenderer {
  // We are omitting props, as we don't use it internally, and more importantly, it completely changes the assignability of meta.component.
  // Try not omitting, and check the type errros in the test file, if you want to learn more.
  component: object;
  storyResult: {
    Component: object;
    args: Record<string, unknown>;
  };
}

export interface Parameters {
  renderer: 'ember';
  application?: typeof Application;
}

export type StoryContext = DefaultStoryContext<EmberRenderer> & {
  parameters: DefaultStoryContext<EmberRenderer>['parameters'] & Parameters;
};

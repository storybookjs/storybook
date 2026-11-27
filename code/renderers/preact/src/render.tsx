/** @jsx h */
import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

import * as preact from 'preact';
import { dedent } from 'ts-dedent';

import type { PreactRenderer, StoryFnPreactReturnType } from './types.ts';

const { h } = preact;

export const render: ArgsStoryFn<PreactRenderer> = (args, context) => {
  const { id, component: Component } = context;
  if (!Component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  return h(Component, args);
};

function preactRender(story: StoryFnPreactReturnType | null, canvasElement: Element): void {
  preact.render(story, canvasElement);
}

const StoryHarness: preact.FunctionalComponent<{
  name: string;
  title: string;
  showError: RenderContext<PreactRenderer>['showError'];
  storyFn: () => any;
  canvasElement: PreactRenderer['canvasElement'];
}> = ({ showError, name, title, storyFn, canvasElement }) => {
  const content = preact.h(storyFn as any, null);
  if (!content) {
    showError({
      title: `Expecting a Preact element from the story: "${name}" of "${title}".`,
      description: dedent`
        Did you forget to return the Preact element from the story?
        Use "() => (<MyComp/>)" or "() => { return <MyComp/>; }" when defining the story.
      `,
    });
    return null;
  }
  return content;
};

export function renderToCanvas(
  { storyFn, title, name, showMain, showError, forceRemount }: RenderContext<PreactRenderer>,
  canvasElement: PreactRenderer['canvasElement']
) {
  if (forceRemount) {
    preactRender(null, canvasElement);
  }

  showMain();

  preactRender(
    preact.h(StoryHarness, { name, title, showError, storyFn, canvasElement }),
    canvasElement
  );
}

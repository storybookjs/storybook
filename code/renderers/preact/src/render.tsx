/** @jsx h */
import * as preact from 'preact';
import { dedent } from 'ts-dedent';
import type { RenderContext, ArgsStoryFn } from 'storybook/internal/types';

import type { StoryFnPreactReturnType, PreactRenderer } from './types';

const { h } = preact;

export const render: ArgsStoryFn<PreactRenderer> = (args, context) => {
  const { id, component: Component } = context;
  if (!Component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  // @ts-expect-error I think the type of Component should be Preact.ComponentType, but even that
  // doesn't make TS happy, I suspect because TS wants "react" components.
  return <Component {...args} />;
};

let renderedStory: Element;

function preactRender(story: StoryFnPreactReturnType | null, canvasElement: Element): void {
  // @ts-expect-error (Converted from ts-ignore)
  if (preact.Fragment) {
    // Preact 10 only:
    preact.render(story, canvasElement);
  } else {
    renderedStory = preact.render(story, canvasElement, renderedStory) as unknown as Element;
  }
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

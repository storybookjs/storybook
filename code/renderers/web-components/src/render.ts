/* eslint-disable @typescript-eslint/ban-ts-comment */
import { simulateDOMContentLoaded, simulatePageLoad } from 'storybook/internal/preview-api';
import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { render as litRender } from 'lit';
// Keep `.js` extension to avoid issue with Webpack (related to export map?)
import { isTemplateResult } from 'lit/directive-helpers.js';
import { dedent } from 'ts-dedent';

import type { WebComponentsRenderer } from './types';

const { Node } = global;

export const render: ArgsStoryFn<WebComponentsRenderer> = (args, context) => {
  const { id, component } = context;
  if (!component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  const element = document.createElement(component);
  Object.entries(args).forEach(([key, val]) => {
    // @ts-ignore
    element[key] = val;
  });
  return element;
};

export function renderToCanvas(
  { storyFn, kind, name, showMain, showError, forceRemount }: RenderContext<WebComponentsRenderer>,
  canvasElement: WebComponentsRenderer['canvasElement']
) {
  const element = storyFn();

  showMain();
  if (isTemplateResult(element)) {
    // `render` stores the TemplateInstance in the Node and tries to update based on that.
    // Since we reuse `canvasElement` for all stories, remove the stored instance first.
    // But forceRemount means that it's the same story, so we want too keep the state in that case.
    if (forceRemount || !canvasElement.querySelector('[id="root-inner"]')) {
      canvasElement.innerHTML = '<div id="root-inner"></div>';
    }
    const renderTo = canvasElement.querySelector<HTMLElement>('[id="root-inner"]') as HTMLElement;

    litRender(element, renderTo);
    simulatePageLoad(canvasElement);
  } else if (typeof element === 'string') {
    canvasElement.innerHTML = element;
    simulatePageLoad(canvasElement);
  } else if (element instanceof Node) {
    // Don't re-mount the element if it didn't change and neither did the story
    if (canvasElement.firstChild === element && !forceRemount) {
      return;
    }

    canvasElement.innerHTML = '';
    canvasElement.appendChild(element);
    simulateDOMContentLoaded();
  } else {
    showError({
      title: `Expecting an HTML snippet or DOM node from the story: "${name}" of "${kind}".`,
      description: dedent`
        Did you forget to return the HTML snippet from the story?
        Use "() => <your snippet or node>" or when defining the story.
      `,
    });
  }
}

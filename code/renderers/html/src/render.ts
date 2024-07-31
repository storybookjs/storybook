import { global } from '@storybook/global';

import { dedent } from 'ts-dedent';
import { simulatePageLoad, simulateDOMContentLoaded } from 'storybook/internal/preview-api';
import type { RenderContext, ArgsStoryFn } from 'storybook/internal/types';
import type { HtmlRenderer } from './types';

const { Node } = global;

export const render: ArgsStoryFn<HtmlRenderer> = (args, context) => {
  const { id, component: Component } = context;

  if (typeof Component === 'string') {
    let output = Component;
    Object.keys(args).forEach((key) => {
      output = output.replace(`{{${key}}}`, args[key]);
    });
    return output;
  }
  if (Component instanceof HTMLElement) {
    const output = Component.cloneNode(true) as HTMLElement;
    Object.keys(args).forEach((key) => {
      output.setAttribute(
        key,
        typeof args[key] === 'string' ? args[key] : JSON.stringify(args[key])
      );
    });

    return output;
  }
  if (typeof Component === 'function') {
    return Component(args, context);
  }

  console.warn(dedent`
    Storybook's HTML renderer only supports rendering DOM elements and strings.
    Received: ${Component}
  `);
  throw new Error(`Unable to render story ${id}`);
};

export function renderToCanvas(
  { storyFn, kind, name, showMain, showError, forceRemount }: RenderContext<HtmlRenderer>,
  canvasElement: HtmlRenderer['canvasElement']
) {
  const element = storyFn();
  showMain();
  if (typeof element === 'string') {
    canvasElement.innerHTML = element;
    simulatePageLoad(canvasElement);
  } else if (element instanceof Node) {
    if (canvasElement.firstChild === element && forceRemount === false) {
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

import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { render as litRender } from 'lit';
// Keep `.js` extension to avoid issue with Webpack (related to export map?)
import { isTemplateResult } from 'lit/directive-helpers.js';
import { simulateDOMContentLoaded, simulatePageLoad } from 'storybook/preview-api';
import { dedent } from 'ts-dedent';

import { bindArgs } from './bind-args.ts';
import type { WebComponentsRenderer } from './types.ts';

const { Node } = global;

/** With `experimentalDocgenServer`, returns a DocumentFragment so scoped CSS part and state rules can precede the element. */
export const render: ArgsStoryFn<WebComponentsRenderer> = (args, context) => {
  const { id, component } = context;
  if (!component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  const element = document.createElement(component);
  if (!global.FEATURES?.experimentalDocgenServer) {
    return Object.assign(element, args);
  }

  const styleRules = bindArgs(element, args);
  const fragment = document.createDocumentFragment();
  if (styleRules.length > 0) {
    // A prelude-less `@scope` limits rules to the `<style>`'s parent, and `:scope > style +` to the element right after it, so sibling instances and other stories stay unstyled.
    const style = document.createElement('style');
    style.textContent = `@scope {\n  ${styleRules.map((rule) => `:scope > style + ${rule}`).join('\n  ')}\n}`;
    fragment.append(style);
  }
  fragment.append(element);

  return fragment;
};

export function renderToCanvas(
  { storyFn, kind, name, showMain, showError, forceRemount }: RenderContext<WebComponentsRenderer>,
  canvasElement: WebComponentsRenderer['canvasElement']
): void {
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

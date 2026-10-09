/** @vitest-environment happy-dom */
import type { StoryContextForRender } from 'storybook/internal/types';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { render } from './render.ts';
import type { WebComponentsRenderer } from './types.ts';

const X_CARD_TAG = 'x-card';

class XCard extends HTMLElement {
  static observedAttributes = ['label'];
}

if (!customElements.get(X_CARD_TAG)) {
  customElements.define(X_CARD_TAG, XCard);
}

const CONTEXT = {
  id: 'x-card--a',
  component: X_CARD_TAG,
} as StoryContextForRender<WebComponentsRenderer>;

describe('render', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('assigns every arg as a property when the flag is off', () => {
    const element = render({ label: 'x', 'my-change-event': vi.fn() }, CONTEXT) as HTMLElement & {
      label?: string;
      'my-change-event'?: unknown;
    };

    expect(element.localName).toBe(X_CARD_TAG);
    expect(element.label).toBe('x');
    expect(element['my-change-event']).toBeTypeOf('function');
    expect(element.hasAttribute('label')).toBe(false);
  });

  it('returns a fragment that binds observed attributes and event args when the flag is on', () => {
    const handler = vi.fn();
    vi.stubGlobal('FEATURES', { docgenServer: true });

    const result = render({ label: 'x', 'my-change-event': handler }, CONTEXT);
    expect(result).toBeInstanceOf(DocumentFragment);
    const element = (result as DocumentFragment).lastElementChild as HTMLElement;
    const event = new CustomEvent('my-change');
    element.dispatchEvent(event);

    expect(element.getAttribute('label')).toBe('x');
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('returns a fragment with scoped style rules before the element when the flag is on', () => {
    vi.stubGlobal('FEATURES', { docgenServer: true });

    const result = render({ 'panel-part': 'color: red;' }, CONTEXT) as DocumentFragment;
    const host = document.createElement('div');
    host.append(result);

    expect(host.innerHTML).toBe(
      '<style>@scope {\n  :scope > style + x-card::part(panel) { color: red; }\n}</style><x-card></x-card>'
    );
    expect(host.lastElementChild?.localName).toBe(X_CARD_TAG);
  });
});

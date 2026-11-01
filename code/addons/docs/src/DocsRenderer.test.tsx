// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import type { DocsContextProps, Parameters, Renderer } from 'storybook/internal/types';

import { DocsRenderer } from './DocsRenderer.tsx';

// Minimal stand-in for `DocsContainer`, which needs a full docs context the tests do not have.
const TestContainer = ({ children }: React.PropsWithChildren) => <>{children}</>;

const docsParameter = (page: React.ComponentType): Parameters => ({
  page,
  container: TestContainer,
});

// A docs render creates its context once and passes the same instance to every re-render.
const createContext = () => ({}) as DocsContextProps<Renderer>;

const mounted: { renderer: DocsRenderer<Renderer>; element: HTMLElement }[] = [];

const setup = () => {
  const renderer = new DocsRenderer<Renderer>();
  const element = document.createElement('div');
  mounted.push({ renderer, element });
  return { renderer, element };
};

afterEach(() => {
  mounted.splice(0).forEach(({ renderer, element }) => renderer.unmount(element));
});

describe('DocsRenderer', () => {
  it('re-renders the docs page without remounting it', async () => {
    let renders = 0;
    const Page = () => {
      renders += 1;
      return <p>docs page</p>;
    };
    const context = createContext();
    const { renderer, element } = setup();

    await renderer.render(context, docsParameter(Page), element);
    const paragraph = element.querySelector('p');
    expect(renders).toBe(1);

    // A globals change re-renders the docs page so containers read the new globals (#18477), but
    // must not remount it: remounting tears down every inline story on the page (#37105).
    await renderer.render(context, docsParameter(Page), element);

    expect(renders).toBe(2);
    expect(element.querySelector('p')).toBe(paragraph);
  });

  it('mounts a fresh docs tree when another docs page takes over', async () => {
    // The same page component, as two autodocs entries of one component would render, and the same
    // renderer instance, as a custom `docs.renderer` that reuses one would.
    const Page = () => <p>docs page</p>;
    const { renderer, element } = setup();

    await renderer.render(createContext(), docsParameter(Page), element);
    const paragraph = element.querySelector('p');

    await renderer.render(createContext(), docsParameter(Page), element);

    // Mounted fresh, so state of the previous page (anchors, canvas zoom, ...) does not leak.
    expect(element.querySelector('p')).not.toBe(paragraph);
    expect(element.textContent).toBe('docs page');
  });

  it('recovers from a render error on the next render', async () => {
    let shouldThrow = true;
    const Page = () => {
      if (shouldThrow) {
        throw new Error('docs render failed');
      }
      return <p>recovered</p>;
    };
    const context = createContext();
    const { renderer, element } = setup();

    await expect(renderer.render(context, docsParameter(Page), element)).rejects.toThrow(
      'docs render failed'
    );
    expect(element.textContent).not.toContain('recovered');

    shouldThrow = false;
    await renderer.render(context, docsParameter(Page), element);

    expect(element.textContent).toContain('recovered');
  });
});

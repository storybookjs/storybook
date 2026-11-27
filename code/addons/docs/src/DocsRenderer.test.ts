// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FC } from 'react';

import type { DocsContextProps } from 'storybook/internal/types';

import { DocsRenderer } from './index.ts';

const loaded = vi.hoisted(() => ({ blocks: false, reactDomClient: false }));

// A mock factory runs when its module is first imported, which is how the tests see a load.
vi.mock('@storybook/addon-docs/blocks', async () => {
  loaded.blocks = true;
  const { createElement } = await import('react');
  return {
    Docs: ({ docsParameter }: { docsParameter: { page: FC } }) => createElement(docsParameter.page),
    AnchorMdx: () => null,
    CodeOrSourceMdx: () => null,
    HeadersMdx: {},
  };
});
vi.mock('react-dom/client', async (importOriginal) => {
  loaded.reactDomClient = true;
  return importOriginal();
});

// Read before any test runs: the first render loads both modules for the whole file.
const loadedWithEntry = { ...loaded };

const context = {} as DocsContextProps;

let element: HTMLElement;

beforeEach(() => {
  element = document.createElement('div');
});

afterEach(() => {
  new DocsRenderer().unmount(element);
});

describe('DocsRenderer', () => {
  it('leaves the docs blocks and the React DOM client unloaded when the package entry is imported', () => {
    expect(loadedWithEntry).toEqual({ blocks: false, reactDomClient: false });
  });

  it('loads the docs blocks and the React DOM client to render', async () => {
    await new DocsRenderer().render(context, { page: () => 'Docs page' }, element);

    expect(loaded).toEqual({ blocks: true, reactDomClient: true });
  });

  it('resolves once the docs page is in the element', async () => {
    await new DocsRenderer().render(context, { page: () => 'Docs page' }, element);

    expect(element.textContent).toBe('Docs page');
  });

  it('rejects with the error thrown while rendering the docs page', async () => {
    const error = new Error('Docs rendering error');
    const page = () => {
      throw error;
    };

    await expect(new DocsRenderer().render(context, { page }, element)).rejects.toBe(error);
  });

  it('removes the docs page from the element on unmount', async () => {
    const renderer = new DocsRenderer();
    await renderer.render(context, { page: () => 'Docs page' }, element);

    renderer.unmount(element);

    expect(element.textContent).toBe('');
  });
});

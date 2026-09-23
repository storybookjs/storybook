// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

const { createRoot } = vi.hoisted(() => ({ createRoot: vi.fn() }));

vi.mock('react-dom/client', () => ({ createRoot }));

import { renderElement, unmountElement } from './react-dom-client.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('react-dom-client', () => {
  it('waits for the layout-effect callback outside act', async () => {
    const root = { render: vi.fn(), unmount: vi.fn() };
    createRoot.mockReturnValue(root);
    const element = document.createElement('div');

    const rendered = renderElement(<div>content</div>, element);
    let settled = false;
    void rendered.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);

    const callback = (root.render.mock.calls[0][0] as React.ReactElement<{ callback: () => void }>)
      .props.callback;

    callback();

    await expect(rendered).resolves.toBeUndefined();
  });

  it('reuses roots, ignores new options, and creates a new root after unmounting', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const firstRoot = { render: vi.fn(), unmount: vi.fn() };
    const secondRoot = { render: vi.fn(), unmount: vi.fn() };
    createRoot.mockReturnValueOnce(firstRoot).mockReturnValueOnce(secondRoot);
    const element = document.createElement('div');

    await renderElement(<div>first</div>, element, { identifierPrefix: 'first' });
    await renderElement(<div>second</div>, element, { identifierPrefix: 'second' });

    expect(createRoot).toHaveBeenCalledOnce();
    expect(createRoot).toHaveBeenCalledWith(element, { identifierPrefix: 'first' });
    expect(firstRoot.render).toHaveBeenCalledTimes(2);

    unmountElement(element);
    unmountElement(element);
    await renderElement(<div>third</div>, element);

    expect(firstRoot.unmount).toHaveBeenCalledOnce();
    expect(createRoot).toHaveBeenCalledTimes(2);
    expect(secondRoot.render).toHaveBeenCalledOnce();
  });
});

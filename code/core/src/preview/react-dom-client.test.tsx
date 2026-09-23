// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import React, { useLayoutEffect, useState } from 'react';

const { createRoot } = vi.hoisted(() => ({ createRoot: vi.fn() }));

vi.mock('react-dom/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom/client')>();
  createRoot.mockImplementation(actual.createRoot);
  return { ...actual, createRoot };
});

import { renderElement, unmountElement } from './react-dom-client.tsx';

let elements: Element[] = [];

const createElement = () => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  elements.push(element);
  return element;
};

afterEach(() => {
  elements.forEach(unmountElement);
  elements.forEach((element) => element.remove());
  elements = [];
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('react-dom-client', () => {
  it('commits and resolves after layout effects outside act', async () => {
    let didRunLayoutEffect = false;
    const Content = () => {
      useLayoutEffect(() => {
        didRunLayoutEffect = true;
      }, []);
      return <div>content</div>;
    };
    const element = createElement();

    await renderElement(<Content />, element);

    expect(element.textContent).toBe('content');
    expect(didRunLayoutEffect).toBe(true);
  });

  it('reuses roots, ignores new options, and creates a new root after unmounting', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false);
    let instanceCount = 0;
    const Stateful = () => {
      const [instanceId] = useState(() => ++instanceCount);
      return <div>instance {instanceId}</div>;
    };
    const element = createElement();

    await renderElement(<Stateful />, element, { identifierPrefix: 'first' });
    await renderElement(<Stateful />, element, { identifierPrefix: 'second' });

    expect(createRoot).toHaveBeenCalledOnce();
    expect(createRoot).toHaveBeenCalledWith(element, { identifierPrefix: 'first' });
    expect(element.textContent).toBe('instance 1');

    unmountElement(element);
    unmountElement(element);
    await renderElement(<Stateful />, element);

    expect(createRoot).toHaveBeenCalledTimes(2);
    expect(element.textContent).toBe('instance 2');
  });
});

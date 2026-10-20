// @vitest-environment happy-dom
// Instrumented, as storybook/test is in the preview iframe.
// @vitest-environment-options { "url": "http://localhost/iframe.html?instrument=true" }
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FC } from 'react';
import React, { useState } from 'react';

import type { RenderContext } from 'storybook/internal/types';

import { configure, fireEvent } from 'storybook/test';
import type { getConfig } from 'storybook/test';

import { beforeEach as reactBeforeEach, renderToCanvas } from './entry-preview.tsx';
import type { ReactRenderer } from './types.ts';

type Config = ReturnType<typeof getConfig>;

// Testing Library's own config: the instrumented `getConfig` would track its functions.
const readConfig = () => {
  let config = {} as Config;
  configure((current) => {
    config = { ...current };
    return {};
  });
  return config;
};

const wrappersOf = ({ unstable_advanceTimersWrapper, asyncWrapper, eventWrapper }: Config) => ({
  unstable_advanceTimersWrapper,
  asyncWrapper,
  eventWrapper,
});

const defaults = readConfig();

let canvasElement: HTMLElement;
let cleanups: (() => unknown)[] = [];

beforeEach(() => {
  canvasElement = document.createElement('div');
  document.body.appendChild(canvasElement);
});

afterEach(async () => {
  for (const cleanup of cleanups.reverse()) {
    await cleanup();
  }
  cleanups = [];
  canvasElement.remove();
  configure(wrappersOf(defaults));
});

describe('beforeEach', () => {
  it('sets the three wrappers and its cleanup puts back the ones it found', async () => {
    const previous = {
      unstable_advanceTimersWrapper: (cb: () => unknown) => cb(),
      asyncWrapper: async (cb: () => Promise<unknown>) => cb(),
      eventWrapper: (cb: () => void) => cb(),
    };
    configure(previous);

    const cleanup = await reactBeforeEach();

    const set = wrappersOf(readConfig());
    expect(set.eventWrapper).not.toBe(previous.eventWrapper);
    expect(set.asyncWrapper).not.toBe(previous.asyncWrapper);
    expect(set.unstable_advanceTimersWrapper).not.toBe(previous.unstable_advanceTimersWrapper);

    await cleanup?.();

    expect(wrappersOf(readConfig())).toEqual(previous);
  });

  it('keeps the wrappers until the last of several stories is left, in any order', async () => {
    const cleanupA = await reactBeforeEach();
    const cleanupB = await reactBeforeEach();

    await cleanupA?.();
    expect(readConfig().eventWrapper).not.toBe(defaults.eventWrapper);

    await cleanupB?.();
    expect(wrappersOf(readConfig())).toEqual(wrappersOf(defaults));
  });

  it("leaves the functions of Testing Library's config as they are", async () => {
    const cleanup = await reactBeforeEach();
    await cleanup?.();

    expect(readConfig()).toEqual(defaults);
  });

  it('commits the update of an event fired after it without waiting', async () => {
    const Counter: FC = () => {
      const [count, setCount] = useState(0);
      return <button onMouseMove={() => setCount(count + 1)}>moved {count}</button>;
    };
    cleanups.push(
      await renderToCanvas(
        {
          storyContext: { id: 'counter--story', viewMode: 'story', parameters: {} },
          unboundStoryFn: Counter,
          showMain: () => {},
          showException: () => {},
          forceRemount: true,
        } as unknown as RenderContext<ReactRenderer>,
        canvasElement
      )
    );
    cleanups.push((await reactBeforeEach())!);

    fireEvent.mouseMove(canvasElement.querySelector('button')!);

    expect(canvasElement.textContent).toBe('moved 1');
  });
});

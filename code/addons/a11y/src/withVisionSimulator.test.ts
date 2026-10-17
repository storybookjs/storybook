// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoryContextForRender } from 'storybook/internal/types';

import { useCallback, useEffect } from 'storybook/preview-api';

import { filters } from './visionSimulatorFilters.ts';
import { withVisionSimulator } from './withVisionSimulator.ts';

vi.mock('storybook/preview-api', { spy: true });

const mockedUseCallback = vi.mocked(useCallback);
const mockedUseEffect = vi.mocked(useEffect);
const cleanups: Array<() => void> = [];

const createContext = (disable = false): StoryContextForRender => {
  const context: StoryContextForRender = {
    componentId: 'test',
    title: 'Test',
    kind: 'Test',
    id: 'test--story',
    name: 'Story',
    story: 'Story',
    tags: [],
    parameters: disable ? { visionSimulator: { disable: true } } : {},
    initialArgs: {},
    argTypes: {},
    args: {},
    globals: { vision: 'achromatopsia' },
    globalTypes: {},
    loaded: {},
    abortSignal: new AbortController().signal,
    canvasElement: document.body,
    hooks: {},
    originalStoryFn: vi.fn(),
    viewMode: 'story',
    step: vi.fn(),
    context: null!,
    canvas: null!,
    userEvent: null!,
    mount: vi.fn(),
    reporting: {
      reports: [],
      addReport: vi.fn(),
    },
  };

  context.context = context;
  return context;
};

const runDecorator = (disable = false) => withVisionSimulator(vi.fn(), createContext(disable));

describe('withVisionSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanups.length = 0;

    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    document.body.className = 'sb-show-main';

    mockedUseCallback.mockImplementation(<T>(callback: T) => callback);
    mockedUseEffect.mockImplementation((effect) => {
      const cleanup = effect();

      if (typeof cleanup === 'function') {
        cleanups.push(cleanup);
      }
    });
  });

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }

    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    document.body.className = '';
  });

  it('applies the selected vision filter when enabled', () => {
    runDecorator();

    expect(document.body.style.filter).toBe(filters.achromatopsia.filter);
  });

  it('does not apply the selected vision filter when disabled', () => {
    document.body.style.filter = 'brightness(80%)';

    runDecorator(true);

    expect(document.body.style.filter).toBe('brightness(80%)');
  });
});

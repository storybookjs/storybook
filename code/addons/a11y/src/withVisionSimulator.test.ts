// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/client-logger';
import type { StoryContextForRender } from 'storybook/internal/types';

import { useCallback, useEffect } from 'storybook/preview-api';

import { filters } from './visionSimulatorFilters.ts';
import { withVisionSimulator } from './withVisionSimulator.ts';

vi.mock('storybook/internal/client-logger', { spy: true });
vi.mock('storybook/preview-api', { spy: true });

const mockedWarn = vi.mocked(once.warn);
const mockedUseCallback = vi.mocked(useCallback);
const mockedUseEffect = vi.mocked(useEffect);
const cleanups: Array<() => void> = [];

const createContext = (vision?: string, disable = false): StoryContextForRender => {
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
    globals: vision === undefined ? {} : { vision },
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

const runDecorator = (vision?: string, disable = false) =>
  withVisionSimulator(vi.fn(), createContext(vision, disable));

describe('withVisionSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWarn.mockReturnValue(undefined);
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

  it('does not warn when globals.vision is unset', () => {
    runDecorator();

    expect(mockedWarn).not.toHaveBeenCalled();
  });

  it('removes an existing vision filter when globals.vision is unavailable', () => {
    document.body.style.filter = `${filters.protanopia.filter} brightness(80%)`;

    runDecorator('protanomaly');

    expect(document.body.style.filter).toBe('brightness(80%)');
  });

  it('does not warn when globals.vision references an available simulation', () => {
    runDecorator('protanopia');

    expect(mockedWarn).not.toHaveBeenCalled();
  });

  it('warns when globals.vision references an unavailable simulation', () => {
    runDecorator('protanomaly');

    expect(mockedWarn).toHaveBeenCalledTimes(1);
    expect(mockedWarn).toHaveBeenCalledWith(
      `The vision simulation "protanomaly" is not available. Remove or replace the "globals.vision" value. Available values: ${Object.keys(filters).join(', ')}.`
    );
  });

  it('applies the selected vision filter when enabled', () => {
    runDecorator('achromatopsia');

    expect(document.body.style.filter).toBe(filters.achromatopsia.filter);
  });

  it('does not apply the selected vision filter when disabled', () => {
    document.body.style.filter = 'brightness(80%)';

    runDecorator('achromatopsia', true);

    expect(document.body.style.filter).toBe('brightness(80%)');
  });
});

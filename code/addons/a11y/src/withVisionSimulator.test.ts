// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/client-logger';
import type { StoryContext } from 'storybook/internal/types';

import { useCallback, useEffect } from 'storybook/preview-api';

import { filters } from './visionSimulatorFilters.ts';
import { withVisionSimulator } from './withVisionSimulator.ts';

vi.mock('storybook/internal/client-logger', { spy: true });
vi.mock('storybook/preview-api', { spy: true });

const mockedWarn = vi.mocked(once.warn);
const mockedUseCallback = vi.mocked(useCallback);
const mockedUseEffect = vi.mocked(useEffect);

const createContext = (vision?: string): StoryContext => {
  const context: StoryContext = {
    componentId: 'test',
    title: 'Test',
    kind: 'Test',
    id: 'test--story',
    name: 'Story',
    story: 'Story',
    tags: [],
    parameters: {},
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

const runDecorator = (vision?: string) => withVisionSimulator(vi.fn(), createContext(vision));

describe('withVisionSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWarn.mockReturnValue(undefined);
    mockedUseCallback.mockImplementation(<T>(callback: T) => callback);
    mockedUseEffect.mockImplementation((effect) => {
      const cleanup = effect();

      if (typeof cleanup === 'function') {
        cleanup();
      }
    });

    document.body.innerHTML = '';
    document.body.removeAttribute('style');
  });

  it('does not warn when globals.vision is unset', () => {
    runDecorator();

    expect(mockedWarn).not.toHaveBeenCalled();
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
});

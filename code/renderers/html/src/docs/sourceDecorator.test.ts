/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';

import { addons, emitTransformCode, useEffect, useRef, useState } from 'storybook/preview-api';

import { sourceDecorator } from './sourceDecorator';

// Mock the storybook preview-api
vi.mock('storybook/preview-api', () => ({
  addons: {
    getChannel: vi.fn(),
  },
  useEffect: vi.fn((fn) => fn()),
  useRef: vi.fn(),
  emitTransformCode: vi.fn(),
}));

describe('sourceDecorator', () => {
  const mockChannel = {
    emit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addons.getChannel).mockReturnValue(mockChannel as any);
    vi.mocked(useRef).mockReturnValue({ current: undefined });
  });

  it('should not render source for non-args stories', () => {
    const storyFn = () => '<div>Test Story</div>';
    const context = {
      id: 'test-story',
      parameters: {
        __isArgsStory: false,
        docs: { source: {} },
      },
      args: {},
      unmappedArgs: {},
    };

    sourceDecorator(storyFn, context as any);

    expect(emitTransformCode).not.toHaveBeenCalled();
  });

  it('should render source for args stories', () => {
    const storyContent = '<div>Test Story</div>';
    const storyFn = () => storyContent;
    const context = {
      id: 'test-story',
      parameters: {
        __isArgsStory: true,
        docs: { source: {} },
      },
      args: {},
      unmappedArgs: {},
    };

    sourceDecorator(storyFn, context as any);

    expect(emitTransformCode).toHaveBeenCalledWith(storyContent, context);
  });

  it('should handle Element type story returns', () => {
    const element = document.createElement('div');
    element.innerHTML = 'Test Story';
    const storyFn = () => element;
    const context = {
      id: 'test-story',
      parameters: {
        __isArgsStory: true,
        docs: { source: {} },
      },
      args: {},
      unmappedArgs: {},
    };

    sourceDecorator(storyFn, context as any);

    expect(emitTransformCode).toHaveBeenCalledWith(element.outerHTML, context);
  });

  it('should emit SNIPPET_RENDERED event when source is available', () => {
    const source = '<div>Test Story</div>';

    const storyFn = () => source;
    const context = {
      id: 'test-story',
      parameters: {
        __isArgsStory: true,
        docs: { source: {} },
      },
      args: {},
      unmappedArgs: {},
    };

    sourceDecorator(storyFn, context as any);

    expect(emitTransformCode).toHaveBeenCalledWith(source, context);
  });

  it('should respect excludeDecorators parameter', () => {
    const originalStoryContent = '<div>Original Story</div>';
    const decoratedStoryContent = '<div>Decorated Story</div>';
    const context = {
      id: 'test-story',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            excludeDecorators: true,
          },
        },
      },
      args: {},
      unmappedArgs: {},
      originalStoryFn: () => originalStoryContent,
    };

    const storyFn = () => decoratedStoryContent;

    sourceDecorator(storyFn, context as any);

    expect(emitTransformCode).toHaveBeenCalledWith(originalStoryContent, context);
  });

  it('should skip source render when type is CODE', () => {
    const storyFn = () => '<div>Test Story</div>';
    const context = {
      id: 'test-story',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            type: SourceType.CODE,
            code: 'const x = 1;',
          },
        },
      },
      args: {},
      unmappedArgs: {},
    };

    sourceDecorator(storyFn, context as any);

    expect(emitTransformCode).not.toHaveBeenCalled();
  });
});

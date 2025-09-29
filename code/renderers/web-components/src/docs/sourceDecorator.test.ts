/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceType } from 'storybook/internal/docs-tools';

import { render } from 'lit';
import { addons, emitTransformCode, useEffect, useRef } from 'storybook/preview-api';

import { sourceDecorator } from './sourceDecorator';

vi.mock('storybook/preview-api', () => ({
  addons: {
    getChannel: vi.fn(),
  },
  useEffect: vi.fn((cb) => cb()),
  useRef: vi.fn(),
  emitTransformCode: vi.fn((code) => code),
}));

vi.mock('lit', () => ({
  render: vi.fn(),
}));

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('sourceDecorator', () => {
  const mockChannel = {
    emit: vi.fn(),
  };

  const mockContext = {
    id: 'test-story',
    args: { foo: 'bar' },
    unmappedArgs: { foo: 'bar' },
    parameters: {
      docs: {
        source: {},
      },
      __isArgsStory: true,
    },
    originalStoryFn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRef).mockReturnValue({ current: undefined });
    vi.mocked(addons.getChannel).mockReturnValue(mockChannel as any);
    vi.mocked(useEffect).mockImplementation((cb) => setTimeout(() => cb(), 0));
  });

  it('should render source for a basic story', () => {
    const storyFn = () => document.createElement('div');
    const mockDiv = document.createElement('div');
    mockDiv.innerHTML = '<test-element>content</test-element>';
    vi.mocked(render).mockImplementation((_, container): any => {
      if (container instanceof HTMLElement) {
        container.innerHTML = '<test-element>content</test-element>';
      }
    });

    sourceDecorator(storyFn, mockContext as any);

    expect(render).toHaveBeenCalled();
  });

  it('should skip source rendering when type is CODE', () => {
    const storyFn = () => document.createElement('div');
    const contextWithCode = {
      ...mockContext,
      parameters: {
        docs: {
          source: {
            type: SourceType.CODE,
          },
        },
      },
    };

    sourceDecorator(storyFn, contextWithCode as any);

    expect(render).not.toHaveBeenCalled();
    expect(mockChannel.emit).not.toHaveBeenCalled();
  });

  it('should handle DocumentFragment stories', async () => {
    const fragment = document.createDocumentFragment();
    const element = document.createElement('test-element');
    element.textContent = 'fragment content';
    fragment.appendChild(element);

    const storyFn = () => fragment;
    vi.mocked(render).mockImplementation((_, container): any => {
      if (container instanceof HTMLElement) {
        container.innerHTML = '<test-element>fragment content</test-element>';
      }
    });

    sourceDecorator(storyFn, mockContext as any);
    await tick();

    expect(render).toHaveBeenCalled();
    expect(emitTransformCode).toHaveBeenCalledWith(
      '<test-element>fragment content</test-element>',
      mockContext
    );
  });

  it('should force render when type is DYNAMIC', async () => {
    const storyFn = () => document.createElement('div');
    const contextWithDynamic = {
      ...mockContext,
      parameters: {
        docs: {
          source: {
            type: SourceType.DYNAMIC,
          },
        },
        __isArgsStory: false, // This would normally prevent rendering
      },
    };

    vi.mocked(render).mockImplementation((_, container): any => {
      if (container instanceof HTMLElement) {
        container.innerHTML = '<test-element>dynamic content</test-element>';
      }
    });

    sourceDecorator(storyFn, contextWithDynamic as any);

    await tick();

    expect(render).toHaveBeenCalled();
    expect(emitTransformCode).toHaveBeenCalledWith(
      '<test-element>dynamic content</test-element>',
      contextWithDynamic
    );
  });
});

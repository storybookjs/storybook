/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';

import { render } from 'lit';
import { addons, useState } from 'storybook/preview-api';

import { sourceDecorator } from './sourceDecorator';

vi.mock('storybook/preview-api', () => ({
  addons: {
    getChannel: vi.fn(),
  },
  useEffect: vi.fn((cb) => cb()),
  useState: vi.fn(),
  useTransformCode: vi.fn((code) => code),
}));

vi.mock('lit', () => ({
  render: vi.fn(),
}));

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

  const mockSetSource = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useState).mockReturnValue([undefined, mockSetSource]);
    vi.mocked(addons.getChannel).mockReturnValue(mockChannel as any);
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

  it('should handle DocumentFragment stories', () => {
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

    expect(render).toHaveBeenCalled();
    expect(mockSetSource).toHaveBeenCalledWith(expect.stringContaining('fragment content'));
  });

  it('should force render when type is DYNAMIC', () => {
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

    expect(render).toHaveBeenCalled();
    expect(mockSetSource).toHaveBeenCalledWith(expect.stringContaining('dynamic content'));
  });
});

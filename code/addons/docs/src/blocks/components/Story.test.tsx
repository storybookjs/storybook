// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "disableIframePageLoading": true } }
import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import type { DocsContextProps, PreparedStory } from 'storybook/internal/types';

import { DocsContext } from '../blocks/DocsContext';
import { Story } from './Story';

const story = { id: 'button--primary', name: 'Primary' } as PreparedStory;

const createMockContext = (handlers: Record<string, (...args: any[]) => void>) =>
  ({
    storyById: vi.fn(() => story),
    getStoryContext: vi.fn(() => ({
      initialGlobals: { theme: 'light' },
      globals: { theme: 'dark' },
    })),
    channel: {
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
      }),
      off: vi.fn(),
    },
  }) as unknown as DocsContextProps;

const getIframeSrc = (container: HTMLElement) =>
  container.querySelector('iframe')?.getAttribute('src');

describe('Story', () => {
  afterEach(() => vi.clearAllMocks());

  describe('inline: false', () => {
    it('carries the active globals in the iframe src', () => {
      const { container } = render(
        <DocsContext.Provider value={createMockContext({})}>
          <Story story={story} inline={false} primary={false} height="100px" />
        </DocsContext.Provider>
      );
      expect(getIframeSrc(container)).toBe(
        'iframe.html?viewMode=story&globals=theme%3Adark&id=button--primary'
      );
    });

    it('reloads the iframe when the user changes a global', () => {
      const handlers: Record<string, (...args: any[]) => void> = {};
      const { container } = render(
        <DocsContext.Provider value={createMockContext(handlers)}>
          <Story story={story} inline={false} primary={false} height="100px" />
        </DocsContext.Provider>
      );
      expect(getIframeSrc(container)).toContain('globals=theme%3Adark');

      act(() => {
        handlers[GLOBALS_UPDATED]({
          initialGlobals: { theme: 'light' },
          globals: { theme: 'light' },
        });
      });
      expect(getIframeSrc(container)).toBe('iframe.html?viewMode=story&id=button--primary');
    });

    it('omits globals when rendered outside a docs context', () => {
      const { container } = render(
        <Story story={story} inline={false} primary={false} height="100px" />
      );
      expect(getIframeSrc(container)).toBe('iframe.html?viewMode=story&id=button--primary');
    });
  });
});

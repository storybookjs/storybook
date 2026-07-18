// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import React from 'react';
import type { FC, PropsWithChildren } from 'react';

import { GLOBALS_UPDATED, UPDATE_GLOBALS } from 'storybook/internal/core-events';
import type { Globals } from 'storybook/internal/csf';

import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import { useGlobals } from './useGlobals';

type MockDocsContext = Pick<DocsContextProps, 'channel' | 'getGlobals'>;

const Wrapper: FC<PropsWithChildren<{ context: MockDocsContext }>> = ({
  children,
  context,
}) => <DocsContext.Provider value={context as DocsContextProps}>{children}</DocsContext.Provider>;

describe('useGlobals', () => {
  it('reads current globals and reacts to updates', () => {
    let onGlobalsUpdated = (_changed: { globals: Globals }) => {};
    const channel = {
      on: vi.fn((event: string, listener: typeof onGlobalsUpdated) => {
        if (event === GLOBALS_UPDATED) {
          onGlobalsUpdated = listener;
        }
      }),
      off: vi.fn(),
      emit: vi.fn(),
    };
    const context = {
      channel,
      getGlobals: vi.fn(() => ({ theme: 'light' })),
    } as unknown as MockDocsContext;

    const { result, unmount } = renderHook(() => useGlobals(), {
      wrapper: ({ children }) => <Wrapper context={context}>{children}</Wrapper>,
    });

    expect(result.current[0]).toEqual({ theme: 'light' });
    expect(channel.on).toHaveBeenCalledWith(GLOBALS_UPDATED, onGlobalsUpdated);

    act(() => onGlobalsUpdated({ globals: { theme: 'dark' } }));

    expect(result.current[0]).toEqual({ theme: 'dark' });

    unmount();
    expect(channel.off).toHaveBeenCalledWith(GLOBALS_UPDATED, onGlobalsUpdated);
  });

  it('emits global updates', () => {
    const channel = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    const context = {
      channel,
      getGlobals: vi.fn(() => ({ theme: 'light' })),
    } as unknown as MockDocsContext;

    const { result } = renderHook(() => useGlobals(), {
      wrapper: ({ children }) => <Wrapper context={context}>{children}</Wrapper>,
    });

    act(() => result.current[1]({ theme: 'dark' }));

    expect(channel.emit).toHaveBeenCalledWith(UPDATE_GLOBALS, {
      globals: { theme: 'dark' },
    });
  });
});

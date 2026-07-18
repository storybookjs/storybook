// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  let onGlobalsUpdated: (changed: { globals: Globals }) => void;
  let channel: Pick<DocsContextProps['channel'], 'emit' | 'off' | 'on'>;
  let context: MockDocsContext;

  beforeEach(() => {
    onGlobalsUpdated = () => {};
    channel = {
      on: vi.fn((event: string, listener: typeof onGlobalsUpdated) => {
        if (event === GLOBALS_UPDATED) {
          onGlobalsUpdated = listener;
        }
      }),
      off: vi.fn(),
      emit: vi.fn(),
    };
    context = {
      channel,
      getGlobals: vi.fn(() => ({ theme: 'light' })),
    } as unknown as MockDocsContext;
  });

  it('reads current globals and reacts to updates', () => {
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
    const { result } = renderHook(() => useGlobals(), {
      wrapper: ({ children }) => <Wrapper context={context}>{children}</Wrapper>,
    });

    act(() => result.current[1]({ theme: 'dark' }));

    expect(channel.emit).toHaveBeenCalledWith(UPDATE_GLOBALS, {
      globals: { theme: 'dark' },
    });
  });
});

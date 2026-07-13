// @vitest-environment happy-dom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { API_PreparedStoryIndex } from 'storybook/internal/types';

import type { API, Combo, State } from '../root.tsx';
import { Provider as ManagerProvider, mockChannel } from '../root.tsx';

// The stories module destructures `fetch` from `@storybook/global` at import time to fetch the
// index on init. Reject it so the init no-ops (into indexError) instead of hitting the network.
// Return a fresh `global` object rather than mutating the shared global in place, so the mocked
// `fetch` cannot leak into other test files. We copy all own property descriptors (a plain spread
// drops non-enumerable globals like happy-dom's `document`) and keep the prototype, so the other
// globals that manager modules rely on are preserved.
vi.mock('@storybook/global', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@storybook/global')>();
  const global = Object.create(
    Object.getPrototypeOf(mod.global),
    Object.getOwnPropertyDescriptors(mod.global)
  );
  global.fetch = vi.fn().mockRejectedValue(new Error('network disabled in test'));
  return { ...mod, global };
});

afterEach(() => {
  cleanup();
});

const mockIndex: API_PreparedStoryIndex = {
  v: 5,
  entries: {
    'a--visible': {
      type: 'story',
      id: 'a--visible',
      title: 'A',
      name: 'Visible',
      importPath: './a.stories.tsx',
      // "dev" is auto-added at real index time and is required by the built-in static filter.
      tags: ['dev'],
    },
    'a--hidden': {
      type: 'story',
      id: 'a--hidden',
      title: 'A',
      name: 'Hidden',
      importPath: './a.stories.tsx',
      tags: ['dev'],
    },
  } as any,
};

describe('ManagerProvider', () => {
  it('applies a filter set during addon registration (before mount) to the initial index', async () => {
    let api: API | undefined;
    let latestState: State | undefined;

    // Simulate an addon that calls experimental_setFilter synchronously from its register callback.
    // handleAPI runs in the constructor, before the component mounts.
    const provider = {
      channel: mockChannel(),
      getConfig: () => ({}),
      getElements: () => ({}),
      handleAPI: (a: API) => {
        api = a;
        a.experimental_setFilter('addon-filter', (item) => !item.id.includes('hidden'));
      },
    };

    render(
      <ManagerProvider
        provider={provider as any}
        docsOptions={{}}
        location={{ search: '' } as any}
        path="/"
        viewMode="story"
        storyId="a--visible"
        refId={undefined}
        navigate={vi.fn() as any}
      >
        {(combo: Combo) => {
          latestState = combo.state;
          return null;
        }}
      </ManagerProvider>
    );

    // The filter registered during (pre-mount) addon registration must have landed in state.
    expect(latestState?.filters).toHaveProperty('addon-filter');

    // The preview would emit SET_INDEX after mount; setIndex reads state.filters, which already
    // contains the filter registered during addon registration. setIndex's returned promise
    // resolves via React's class-component setState callback, which does not settle within an
    // async act() here, so trigger it inside act() and assert on the resulting state via waitFor.
    act(() => {
      void api!.setIndex(mockIndex);
    });

    await waitFor(() => {
      expect(latestState?.filteredIndex).toHaveProperty(['a--visible']);
    });

    // The unfiltered index keeps every entry, the filtered index drops the "hidden" story.
    expect(latestState?.index).toHaveProperty(['a--hidden']);
    expect(latestState?.filteredIndex).not.toHaveProperty(['a--hidden']);
  });
});

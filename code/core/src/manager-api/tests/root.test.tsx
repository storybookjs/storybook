// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import React from 'react';

import { EventEmitter } from 'events';

import type { API } from '../root.tsx';
import { Provider as ManagerProvider } from '../root.tsx';

describe('ManagerProvider', () => {
  it('applies state changes made during addon registration (pre-mount)', async () => {
    // Addon register callbacks run in the ManagerProvider constructor, before React mounts.
    // React silently drops setState calls made before mounting, so the store must apply
    // such patches to the initial state directly. See #35151 QA regression.
    let setFilterPromise: Promise<void> | undefined;
    let registeredAPI: API | undefined;

    const provider = {
      channel: new EventEmitter(),
      getConfig: () => ({}),
      getElements: () => ({}),
      handleAPI: (api: API) => {
        registeredAPI = api;
        setFilterPromise = api.experimental_setFilter('my-addon-filter', () => true);
      },
      renderPreview: () => null,
    };

    render(
      <ManagerProvider
        key="manager"
        provider={provider as any}
        location={{ search: '' } as any}
        path="/"
        storyId={undefined}
        refId={undefined}
        viewMode="story"
        singleStory={false}
        docsOptions={{}}
        navigate={vi.fn()}
      >
        {() => null}
      </ManagerProvider>
    );

    expect(registeredAPI).toBeDefined();
    expect(setFilterPromise).toBeDefined();

    // The promise must resolve; before the fix it hung forever because the React
    // setState callback never fired for pre-mount calls.
    await Promise.race([
      setFilterPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('experimental_setFilter never resolved')), 1000)
      ),
    ]);
  });
});

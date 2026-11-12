import { SvelteKitMockParametersRemovedError } from './errors.ts';

import type { Preview } from '@storybook/svelte';
import {
  pageDefaultsChanged,
  resetAppState,
} from '@storybook/sveltekit/internal/mocks/app/state.svelte.js';
import {
  beginDocsStory,
  endDocsSetup,
  resetMocks,
} from '@storybook/sveltekit/internal/mocks/docs-isolation';
import { setAfterNavigate } from '@storybook/sveltekit/navigation.mock';

import { interceptLinkClicks } from './mocks/link-clicks.ts';

// The paths of the leaves of a parameter object, for example `['state.page', 'hrefs']`
const keyPaths = (value: unknown, depth = 0): string[] => {
  if (depth >= 2 || typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const childPaths = key === 'hrefs' ? [] : keyPaths(child, depth + 1);
    return childPaths.length > 0 ? childPaths.map((path) => `${key}.${path}`) : [key];
  });
};

// The current render of each canvas, to tell if it mounted
const renders = new WeakMap<Element, { mounted: boolean }>();

// The framework's annotations come before the project's, so this runs before every other
// `beforeEach`, and stories set their mocks on top of the defaults
export const beforeEach: Preview['beforeEach'] = ({
  id,
  parameters,
  canvasElement,
  viewMode,
  abortSignal,
}) => {
  if (parameters?.sveltekit_experimental !== undefined) {
    const keys = keyPaths(parameters.sveltekit_experimental);
    throw new SvelteKitMockParametersRemovedError({
      keys: keys.length > 0 ? keys : ['sveltekit_experimental'],
    });
  }

  // Before the reset, so a story that can't share the page doesn't reset another story's mocks
  const endDocsStory =
    viewMode === 'docs' ? beginDocsStory(id, canvasElement, pageDefaultsChanged()) : undefined;
  resetMocks(() => {
    resetAppState();
    // Merges nothing into the default navigation
    setAfterNavigate({});
  });
  const stopLinkClicks = interceptLinkClicks({ canvasElement, viewMode });
  const cleanup = () => {
    stopLinkClicks();
    endDocsStory?.();
  };
  // Core drops this cleanup when a later `beforeEach` throws, so the story never mounts. Core
  // aborts it when it tears it down. A mounted story also gets aborts, such as on a hot update
  // during play, and keeps going.
  const render = { mounted: false };
  if (canvasElement) {
    renders.set(canvasElement, render);
  }
  abortSignal?.addEventListener(
    'abort',
    () => {
      if (!render.mounted) {
        cleanup();
      }
    },
    { once: true }
  );
  return cleanup;
};

// Runs when a story mounts, after every `beforeEach`, so the setup of a story on a docs page ends
export const decorators: Preview['decorators'] = [
  (Story, { canvasElement, viewMode }) => {
    const render = renders.get(canvasElement);
    if (render) {
      render.mounted = true;
    }
    if (viewMode === 'docs') {
      endDocsSetup(canvasElement, pageDefaultsChanged());
    }
    return Story();
  },
];

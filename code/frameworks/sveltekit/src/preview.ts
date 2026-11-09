import { SvelteKitMockParametersRemovedError } from 'storybook/internal/preview-errors';

import type { Preview } from '@storybook/svelte';
import {
  pageDefaultsChanged,
  resetAppState,
  // @ts-expect-error no declaration file for this JS module
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
  // Core gets this cleanup only when every `beforeEach` succeeds, but it always aborts the render
  // when it tears the story down
  abortSignal?.addEventListener('abort', cleanup, { once: true });
  return cleanup;
};

// Runs when a story mounts, after every `beforeEach`, so the setup of a story on a docs page ends
export const decorators: Preview['decorators'] = [
  (Story, { canvasElement, viewMode }) => {
    if (viewMode === 'docs') {
      endDocsSetup(canvasElement, pageDefaultsChanged());
    }
    return Story();
  },
];

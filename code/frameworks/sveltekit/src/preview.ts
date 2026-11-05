import { SvelteKitMockParametersRemovedError } from 'storybook/internal/preview-errors';

import type { Preview } from '@storybook/svelte';
// @ts-expect-error no declaration file for this JS module
import { resetAppState } from '@storybook/sveltekit/internal/mocks/app/state.svelte.js';
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
export const beforeEach: Preview['beforeEach'] = ({ parameters, canvasElement, viewMode }) => {
  if (parameters?.sveltekit_experimental !== undefined) {
    const keys = keyPaths(parameters.sveltekit_experimental);
    throw new SvelteKitMockParametersRemovedError({
      keys: keys.length > 0 ? keys : ['sveltekit_experimental'],
    });
  }

  resetAppState();
  // Merges nothing into the default navigation
  setAfterNavigate({});
  return interceptLinkClicks({ canvasElement, viewMode });
};

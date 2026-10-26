// @ts-check
import { getContext, hasContext, setContext } from 'svelte';

import { storyNameToExportName } from '@storybook/svelte/internal/svelte-csf/component-helpers';

/**
 * @import { Cmp, StoriesExtractorContext, StoriesExtractorContextProps, StoriesRepository } from '@storybook/svelte/internal/svelte-csf/component-helpers'
 */

const CONTEXT_KEY = 'storybook-stories-extractor-context';

/**
 * @template {Cmp} TCmp
 * @param {StoriesExtractorContextProps<TCmp>} storyCmpProps
 * @returns {StoriesExtractorContext<TCmp>}
 */
function buildContext(storyCmpProps) {
  const isExtracting = $state(storyCmpProps.isExtracting);
  const register = $state(storyCmpProps.register);

  return {
    get isExtracting() {
      return isExtracting;
    },
    get register() {
      return register;
    },
  };
}

/**
 * @template {Cmp} TCmp
 * @param {StoriesRepository<TCmp>} repository
 * @returns {void}
 */
export function createStoriesExtractorContext(repository) {
  const { stories } = repository;

  const ctx = buildContext(
    /** @type {StoriesExtractorContextProps<TCmp>} */ ({
      isExtracting: true,
      register: (s) => {
        // A story has `name` when it has no `exportName`
        stories.set(s.exportName ?? storyNameToExportName(/** @type {string} */ (s.name)), s);
      },
    })
  );

  setContext(CONTEXT_KEY, ctx);
}

/**
 * @template {Cmp} TCmp
 * @returns {StoriesExtractorContext<TCmp>}
 */
export function useStoriesExtractor() {
  if (!hasContext(CONTEXT_KEY)) {
    setContext(
      CONTEXT_KEY,
      buildContext({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext(CONTEXT_KEY);
}

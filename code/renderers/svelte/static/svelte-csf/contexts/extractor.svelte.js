// Types: see the .d.ts file next to this one.
import { getContext, hasContext, setContext } from 'svelte';

import { storyNameToExportName } from '@storybook/svelte/internal/svelte-csf/component-helpers';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

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

export function createStoriesExtractorContext(repository) {
  const { stories } = repository;

  const ctx = buildContext({
    isExtracting: true,
    register: (s) => {
      stories.set(s.exportName ?? storyNameToExportName(s.name), s);
    },
  });

  setContext(CONTEXT_KEY, ctx);
}

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

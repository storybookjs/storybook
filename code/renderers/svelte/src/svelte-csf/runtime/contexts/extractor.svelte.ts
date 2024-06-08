// WARN: Temporary location. Feel free to move if needed.
// It is likely this file will be removed if we successfully get rid of `StoriesExtractor`.

import type { Meta, StoryObj } from '@storybook/svelte';
import { getContext, hasContext, setContext } from 'svelte';

import { storyNameToExportName } from '#utils/identifier-utils';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

export interface StoriesExtractorContextProps<TMeta extends Meta> {
  isExtracting: boolean;
  register: (story: StoryObj<TMeta> & { exportName?: string }) => void;
}

function buildContext<TMeta extends Meta>(props: StoriesExtractorContextProps<TMeta>) {
  let isExtracting = $state(props.isExtracting);
  let register = $state(props.register);

  return {
    get isExtracting() {
      return isExtracting;
    },
    get register() {
      return register;
    },
  };
}

export type StoriesExtractorContext<TMeta extends Meta> = ReturnType<typeof buildContext<TMeta>>;

export type StoriesRepository<TMeta extends Meta> = {
  stories: Map<string, StoryObj<TMeta>>;
};

export function createStoriesExtractorContext<TMeta extends Meta>(
  repository: StoriesRepository<TMeta>
): void {
  const { stories } = repository;

  const ctx = buildContext<TMeta>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.exportName ?? storyNameToExportName(s.name!), s);
    },
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoriesExtractor<TMeta extends Meta>() {
  if (!hasContext(CONTEXT_KEY)) {
    setContext(
      CONTEXT_KEY,
      buildContext({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext<StoriesExtractorContext<TMeta>>(CONTEXT_KEY);
}

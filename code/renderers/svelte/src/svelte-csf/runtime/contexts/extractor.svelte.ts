// WARN: Temporary location. Feel free to move if needed.
// It is likely this file will be removed if we successfully get rid of `StoriesExtractor`.

import type { Meta, StoryObj } from '@storybook/svelte';
import type { StoryName } from '@storybook/types';
import { getContext, hasContext, setContext } from 'svelte';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

export interface StoriesExtractorContextProps<TMeta extends Meta> {
  isExtracting: boolean;
  register: (story: StoryObj<TMeta>) => void;
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
  stories: Map<StoryName, StoryObj<TMeta>>;
};

export function createStoriesExtractorContext<TMeta extends Meta>(
  repository: StoriesRepository<TMeta>
): void {
  const { stories } = repository;

  const ctx = buildContext<TMeta>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.name as string, s);
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

import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import type Story from '../Story.svelte';

import type { Cmp } from '../../types.js';
import { storyNameToExportName } from '../../utils/identifier-utils.js';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

export interface StoriesExtractorContextProps<TCmp extends Cmp> {
  isExtracting: boolean;
  register: (storyCmpProps: ComponentProps<typeof Story<TCmp>>) => void;
}

function buildContext<TCmp extends Cmp>(storyCmpProps: StoriesExtractorContextProps<TCmp>) {
  let isExtracting = $state(storyCmpProps.isExtracting);
  let register = $state(storyCmpProps.register);

  return {
    get isExtracting() {
      return isExtracting;
    },
    get register() {
      return register;
    },
  };
}

export type StoriesExtractorContext<TCmp extends Cmp> = ReturnType<typeof buildContext<TCmp>>;

export type StoriesRepository<TCmp extends Cmp> = {
  stories: Map<string, ComponentProps<typeof Story<TCmp>>>;
};

export function createStoriesExtractorContext<TCmp extends Cmp>(
  repository: StoriesRepository<TCmp>
): void {
  const { stories } = repository;

  const ctx = buildContext<TCmp>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.exportName ?? storyNameToExportName(s.name!), s);
    },
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoriesExtractor<TCmp extends Cmp>() {
  if (!hasContext(CONTEXT_KEY)) {
    setContext(
      CONTEXT_KEY,
      buildContext<TCmp>({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext<StoriesExtractorContext<TCmp>>(CONTEXT_KEY);
}

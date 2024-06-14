import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import { storyNameToExportName } from '#utils/identifier-utils';
import type { StoryCmpProps } from '#types';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

export interface StoriesExtractorContextProps<TProps extends StoryCmpProps = StoryCmpProps> {
  isExtracting: boolean;
  register: (storyCmpProps: TProps) => void;
}

function buildContext<TProps extends StoryCmpProps = StoryCmpProps>(
  storyCmpProps: StoriesExtractorContextProps<TProps>
) {
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

export type StoriesExtractorContext<TProps extends StoryCmpProps = StoryCmpProps> = ReturnType<
  typeof buildContext<TProps>
>;

export type StoriesRepository<TProps extends StoryCmpProps = StoryCmpProps> = {
  stories: Map<string, TProps>;
};

export function createStoriesExtractorContext<TProps extends StoryCmpProps = StoryCmpProps>(
  repository: StoriesRepository<TProps>
): void {
  const { stories } = repository;

  const ctx = buildContext<TProps>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.exportName ?? storyNameToExportName(s.name!), s);
    },
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoriesExtractor<TProps extends StoryCmpProps = StoryCmpProps>() {
  if (!hasContext(CONTEXT_KEY)) {
    setContext(
      CONTEXT_KEY,
      buildContext<TProps>({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext<StoriesExtractorContext<TProps>>(CONTEXT_KEY);
}

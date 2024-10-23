import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import { storyNameToExportName } from '#utils/identifier-utils';
import type { Cmp, Meta, StoryCmp } from '#types';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

export interface StoriesExtractorContextProps<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> {
  isExtracting: boolean;
  register: (storyCmpProps: ComponentProps<StoryCmp<TCmp, TMeta>>) => void;
}

function buildContext<TCmp extends Cmp, TMeta extends Meta<TCmp>>(
  storyCmpProps: StoriesExtractorContextProps<TCmp, TMeta>
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

export type StoriesExtractorContext<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> = ReturnType<typeof buildContext<TCmp, TMeta>>;

export type StoriesRepository<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> = {
  stories: Map<string, ComponentProps<StoryCmp<TCmp, TMeta>>>;
};

export function createStoriesExtractorContext<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>(repository: StoriesRepository<TCmp, TMeta>): void {
  const { stories } = repository;

  const ctx = buildContext<TCmp, TMeta>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.exportName ?? storyNameToExportName(s.name!), s);
    },
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoriesExtractor<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>() {
  if (!hasContext(CONTEXT_KEY)) {
    setContext(
      CONTEXT_KEY,
      buildContext<TCmp, TMeta>({
        isExtracting: false,
        register: () => { },
      })
    );
  }

  return getContext<StoriesExtractorContext<TCmp, TMeta>>(CONTEXT_KEY);
}

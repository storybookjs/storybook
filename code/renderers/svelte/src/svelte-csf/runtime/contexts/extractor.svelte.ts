import type { Args } from 'storybook/internal/types';
import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import { storyNameToExportName } from '#utils/identifier-utils';
import type { Cmp, Meta, StoryCmp } from '#types';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

export interface StoriesExtractorContextProps<
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> {
  isExtracting: boolean;
  register: (storyCmpProps: ComponentProps<StoryCmp<TOverrideArgs, TCmp, TMeta>>) => void;
}

function buildContext<TOverrideArgs extends Args, TCmp extends Cmp, TMeta extends Meta<TCmp>>(
  storyCmpProps: StoriesExtractorContextProps<TOverrideArgs, TCmp, TMeta>
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
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> = ReturnType<typeof buildContext<TOverrideArgs, TCmp, TMeta>>;

export type StoriesRepository<
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> = {
  stories: Map<string, ComponentProps<StoryCmp<TOverrideArgs, TCmp, TMeta>>>;
};

export function createStoriesExtractorContext<
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>(repository: StoriesRepository<TOverrideArgs, TCmp, TMeta>): void {
  const { stories } = repository;

  const ctx = buildContext<TOverrideArgs, TCmp, TMeta>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.exportName ?? storyNameToExportName(s.name!), s);
    },
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoriesExtractor<
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>() {
  if (!hasContext(CONTEXT_KEY)) {
    setContext(
      CONTEXT_KEY,
      buildContext<TOverrideArgs, TCmp, TMeta>({
        isExtracting: false,
        register: () => {},
      })
    );
  }

  return getContext<StoriesExtractorContext<TOverrideArgs, TCmp, TMeta>>(CONTEXT_KEY);
}

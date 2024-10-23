import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import type Story from '#runtime/Story.svelte';
import type { CmpOrArgs } from '#types';
import { storyNameToExportName } from '#utils/identifier-utils';

const CONTEXT_KEY = 'storybook-stories-extractor-context';

export interface StoriesExtractorContextProps<
  TCmpOrArgs extends CmpOrArgs,
> {
  isExtracting: boolean;
  register: (storyCmpProps: ComponentProps<typeof Story<TCmpOrArgs>>) => void;
}

function buildContext<TCmp extends CmpOrArgs>(
  storyCmpProps: StoriesExtractorContextProps<TCmp>
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
  TCmpOrArgs extends CmpOrArgs,
> = ReturnType<typeof buildContext<TCmpOrArgs>>;

export type StoriesRepository<
  TCmpOrArgs extends CmpOrArgs,
> = {
  stories: Map<string, ComponentProps<typeof Story<TCmpOrArgs>>>;
};

export function createStoriesExtractorContext<
  TCmpOrArgs extends CmpOrArgs,
>(repository: StoriesRepository<TCmpOrArgs>): void {
  const { stories } = repository;

  const ctx = buildContext<TCmpOrArgs>({
    isExtracting: true,
    register: (s) => {
      stories.set(s.exportName ?? storyNameToExportName(s.name!), s);
    },
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoriesExtractor<
  TCmpOrArgs extends CmpOrArgs,
>() {
  if (!hasContext(CONTEXT_KEY)) {
    setContext(
      CONTEXT_KEY,
      buildContext<TCmpOrArgs>({
        isExtracting: false,
        register: () => { },
      })
    );
  }

  return getContext<StoriesExtractorContext<TCmpOrArgs>>(CONTEXT_KEY);
}

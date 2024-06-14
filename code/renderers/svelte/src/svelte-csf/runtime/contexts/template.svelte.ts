import { getContext, hasContext, setContext } from 'svelte';

import type { Meta, StoryCmp, StoryCmpProps } from '#types';

const CONTEXT_KEYS = 'storybook-stories-template-snippet-context';

function buildContext<TMeta extends Meta = Meta>() {
  let template = $state<StoryCmpProps['children']>();

  function set(snippet?: typeof template) {
    template = snippet;
  }

  return {
    get template() {
      return template;
    },
    set,
  };
}

type StoriesTemplateContext<TMeta extends Meta = Meta> = ReturnType<typeof buildContext<TMeta>>;

export function useStoriesTemplate<TMeta extends Meta = Meta>() {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TMeta>());
  }

  return getContext<StoriesTemplateContext<TMeta>>(CONTEXT_KEYS).template;
}

type InferMeta<TStory extends StoryCmp> =
  TStory extends StoryCmp<infer _TOverrideArgs, infer TMeta extends Meta> ? TMeta : never;

export function setTemplate<TStoryCmp extends StoryCmp = StoryCmp>(
  snippet?: StoriesTemplateContext<InferMeta<TStoryCmp>>['template']
): void {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<InferMeta<TStoryCmp>>());
  }

  const ctx = getContext<StoriesTemplateContext<InferMeta<TStoryCmp>>>(CONTEXT_KEYS);

  ctx.set(snippet);
}

import { getContext, hasContext, setContext } from 'svelte';

import type { StoryCmpProps } from '#types';

const CONTEXT_KEYS = 'storybook-stories-template-snippet-context';

function buildContext() {
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

type StoriesTemplateContext = ReturnType<typeof buildContext>;

export function useStoriesTemplate() {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext());
  }

  return getContext<StoriesTemplateContext>(CONTEXT_KEYS).template;
}

export function setTemplate(snippet?: StoriesTemplateContext['template']): void {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext());
  }

  const ctx = getContext<StoriesTemplateContext>(CONTEXT_KEYS);

  ctx.set(snippet);
}

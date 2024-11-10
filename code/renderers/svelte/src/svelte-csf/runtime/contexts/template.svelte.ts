import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import type Story from '../Story.svelte';

import type { Cmp } from '../../types';

const CONTEXT_KEYS = 'storybook-stories-template-snippet-context';

function buildContext<TCmp extends Cmp>() {
  let template = $state<ComponentProps<typeof Story<TCmp>>['template']>();

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

type StoriesTemplateContext<TCmp extends Cmp> = ReturnType<typeof buildContext<TCmp>>;

export function useStoriesTemplate<TCmp extends Cmp>() {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TCmp>());
  }

  return getContext<StoriesTemplateContext<TCmp>>(CONTEXT_KEYS).template;
}

export function setTemplate<TCmp extends Cmp>(
  snippet?: StoriesTemplateContext<TCmp>['template']
): void {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TCmp>());
  }

  const ctx = getContext<StoriesTemplateContext<TCmp>>(CONTEXT_KEYS);

  ctx.set(snippet);
}

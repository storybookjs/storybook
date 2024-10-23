import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import type { Cmp, Meta, StoryCmp } from '#types';

const CONTEXT_KEYS = 'storybook-stories-template-snippet-context';

function buildContext<TCmp extends Cmp, TMeta extends Meta<TCmp>>() {
  let template = $state<ComponentProps<StoryCmp<TCmp, TMeta>>['children']>();

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

type StoriesTemplateContext<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> = ReturnType<typeof buildContext<TCmp, TMeta>>;

export function useStoriesTemplate<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>() {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TCmp, TMeta>());
  }

  return getContext<StoriesTemplateContext<TCmp, TMeta>>(CONTEXT_KEYS).template;
}

export function setTemplate<TCmp extends Cmp, TMeta extends Meta<TCmp>>(
  snippet?: StoriesTemplateContext<TCmp, TMeta>['template']
): void {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TCmp, TMeta>());
  }

  const ctx = getContext<StoriesTemplateContext<TCmp, TMeta>>(CONTEXT_KEYS);

  ctx.set(snippet);
}

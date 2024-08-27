import type { Args } from 'storybook/internal/types';
import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import type { Cmp, Meta, StoryCmp } from '#types';

const CONTEXT_KEYS = 'storybook-stories-template-snippet-context';

function buildContext<TOverrideArgs extends Args, TCmp extends Cmp, TMeta extends Meta<TCmp>>() {
  let template = $state<ComponentProps<StoryCmp<TOverrideArgs, TCmp, TMeta>>['children']>();

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
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
> = ReturnType<typeof buildContext<TOverrideArgs, TCmp, TMeta>>;

export function useStoriesTemplate<
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>() {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TOverrideArgs, TCmp, TMeta>());
  }

  return getContext<StoriesTemplateContext<TOverrideArgs, TCmp, TMeta>>(CONTEXT_KEYS).template;
}

export function setTemplate<TOverrideArgs extends Args, TCmp extends Cmp, TMeta extends Meta<TCmp>>(
  snippet?: StoriesTemplateContext<TOverrideArgs, TCmp, TMeta>['template']
): void {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TOverrideArgs, TCmp, TMeta>());
  }

  const ctx = getContext<StoriesTemplateContext<TOverrideArgs, TCmp, TMeta>>(CONTEXT_KEYS);

  ctx.set(snippet);
}

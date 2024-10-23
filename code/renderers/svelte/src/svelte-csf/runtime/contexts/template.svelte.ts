import { getContext, hasContext, setContext, type ComponentProps } from 'svelte';

import type Story from '#runtime/Story.svelte';
import type { CmpOrArgs } from '#types';

const CONTEXT_KEYS = 'storybook-stories-template-snippet-context';

function buildContext<TCmpOrArgs extends CmpOrArgs>() {
  let template = $state<ComponentProps<typeof Story<TCmpOrArgs>>['children']>();

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
  TCmpOrArgs extends CmpOrArgs,
> = ReturnType<typeof buildContext<TCmpOrArgs>>;

export function useStoriesTemplate<
  TCmpOrArgs extends CmpOrArgs,
>() {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TCmpOrArgs>());
  }

  return getContext<StoriesTemplateContext<TCmpOrArgs>>(CONTEXT_KEYS).template;
}

export function setTemplate<TCmpOrArgs extends CmpOrArgs>(
  snippet?: StoriesTemplateContext<TCmpOrArgs>['template']
): void {
  if (!hasContext(CONTEXT_KEYS)) {
    setContext(CONTEXT_KEYS, buildContext<TCmpOrArgs>());
  }

  const ctx = getContext<StoriesTemplateContext<TCmpOrArgs>>(CONTEXT_KEYS);

  ctx.set(snippet);
}

import { getContext, hasContext, setContext } from 'svelte';

import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';

const CONTEXT_KEY = 'storybook-registration-context';
const CONTEXT_KEY_COMPONENT = 'storybook-registration-context-component';

export function createRenderContext(props: any = {}) {
  setContext(CONTEXT_KEY, {
    render: true,
    register: () => {},
    meta: {},
    args: {},
    ...props,
  });
}

export function createRegistrationContext(repositories: any) {
  setContext(CONTEXT_KEY, {
    render: false,
    register: (story: any) => {
      repositories.stories.push(story);
    },
    set meta(value: any) {
      // eslint-disable-next-line no-param-reassign
      repositories.meta = value;
    },
    args: {},
  });
}

export function useContext() {
  if (!hasContext(CONTEXT_KEY)) {
    createRenderContext();
  }
  return getContext(CONTEXT_KEY);
}
export function getStoryRenderContext(): {
  argsStore: Writable<Record<string, unknown>>;
  storyContextStore: Writable<Record<string, unknown>>;
} {
  if (!hasContext(CONTEXT_KEY_COMPONENT)) {
    setContext(CONTEXT_KEY_COMPONENT, { argsStore: writable({}), storyContextStore: writable({}) });
  }
  return getContext(CONTEXT_KEY_COMPONENT);
}

export function setStoryRenderContext(args, storyContext) {
  const ctx = getStoryRenderContext();
  ctx.argsStore.set(args);
  ctx.storyContextStore.set(storyContext);
}

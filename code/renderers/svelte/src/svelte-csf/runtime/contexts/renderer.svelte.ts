import { getContext, hasContext, setContext } from 'svelte';

import type { Meta, StoryContext } from '#types';

const CONTEXT_KEY = 'storybook-story-renderer-context';

interface ContextProps<TMeta extends Meta = Meta> {
  currentStoryExportName: string | undefined;
  args: Meta['args'];
  storyContext: StoryContext<TMeta['args']>;
}

function buildContext<TMeta extends Meta = Meta>(props: ContextProps<TMeta>) {
  let currentStoryExportName = $state(props.currentStoryExportName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: ContextProps<TMeta>) {
    currentStoryExportName = props.currentStoryExportName;
    args = props.args;
    storyContext = props.storyContext;
  }

  return {
    get args() {
      return args;
    },
    get storyContext() {
      return storyContext;
    },
    get currentStoryExportName() {
      return currentStoryExportName;
    },
    set,
  };
}

export type StoryRendererContext<TMeta extends Meta = Meta> = ReturnType<
  typeof buildContext<TMeta>
>;

function createStoryRendererContext<TMeta extends Meta = Meta>(): void {
  const ctx = buildContext<TMeta>({
    currentStoryExportName: undefined,
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoryRenderer<TMeta extends Meta = Meta>() {
  if (!hasContext(CONTEXT_KEY)) {
    createStoryRendererContext<TMeta>();
  }

  return getContext<StoryRendererContext<TMeta>>(CONTEXT_KEY);
}

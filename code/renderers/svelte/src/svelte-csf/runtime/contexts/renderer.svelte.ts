import type { Meta, StoryObj, StoryContext } from '@storybook/svelte';
import { getContext, hasContext, setContext } from 'svelte';

const CONTEXT_KEY = 'storybook-story-renderer-context';

interface StoryRendererContextProps<TMeta extends Meta> {
  currentStoryExportName: string | undefined;
  args: StoryObj<TMeta>['args'];
  storyContext: StoryContext<StoryObj<TMeta>['args']>;
}

function buildContext<TMeta extends Meta>(props: StoryRendererContextProps<TMeta>) {
  let currentStoryExportName = $state(props.currentStoryExportName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: StoryRendererContextProps<TMeta>) {
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

export type StoryRendererContext<TMeta extends Meta> = ReturnType<typeof buildContext<TMeta>>;

function createStoryRendererContext<TMeta extends Meta>(): void {
  const ctx = buildContext<TMeta>({
    currentStoryExportName: undefined,
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoryRenderer<TMeta extends Meta>() {
  if (!hasContext(CONTEXT_KEY)) {
    createStoryRendererContext<TMeta>();
  }

  return getContext<StoryRendererContext<TMeta>>(CONTEXT_KEY);
}

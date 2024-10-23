import { getContext, hasContext, setContext } from 'svelte';

import type { CmpOrArgs, StoryAnnotations, StoryContext } from '#types';

const CONTEXT_KEY = 'storybook-story-renderer-context';

interface ContextProps<TCmpOrArgs extends CmpOrArgs> {
  currentStoryExportName: string | undefined;
  args: NonNullable<StoryAnnotations<TCmpOrArgs>['args']>;
  storyContext: StoryContext<TCmpOrArgs>;
}

function buildContext<TCmpOrArgs extends CmpOrArgs>(
  props: ContextProps<TCmpOrArgs>
) {
  let currentStoryExportName = $state(props.currentStoryExportName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: ContextProps<TCmpOrArgs>) {
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

export type StoryRendererContext<
  TCmpOrArgs extends CmpOrArgs = CmpOrArgs,
> = ReturnType<typeof buildContext<TCmpOrArgs>>;

function createStoryRendererContext<
  TCmpOrArgs extends CmpOrArgs,
>(): void {
  const ctx = buildContext<TCmpOrArgs>({
    currentStoryExportName: undefined,
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoryRenderer<
  TCmpOrArgs extends CmpOrArgs,
>() {
  if (!hasContext(CONTEXT_KEY)) {
    createStoryRendererContext<TCmpOrArgs>();
  }

  return getContext<StoryRendererContext<TCmpOrArgs>>(CONTEXT_KEY);
}

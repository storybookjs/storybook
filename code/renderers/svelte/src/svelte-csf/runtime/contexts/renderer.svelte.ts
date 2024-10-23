import { getContext, hasContext, setContext } from 'svelte';

import type { Cmp, Meta, StoryAnnotations, StoryContext } from '#types';

const CONTEXT_KEY = 'storybook-story-renderer-context';

interface ContextProps<TCmp extends Cmp, TMeta extends Meta<TCmp>> {
  currentStoryExportName: string | undefined;
  args: NonNullable<StoryAnnotations<TCmp, TMeta>['args']>;
  storyContext: StoryContext<TCmp, TMeta>;
}

function buildContext<TCmp extends Cmp, TMeta extends Meta<TCmp>>(
  props: ContextProps<TCmp, TMeta>
) {
  let currentStoryExportName = $state(props.currentStoryExportName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: ContextProps<TCmp, TMeta>) {
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
  TCmp extends Cmp = Cmp,
  TMeta extends Meta<TCmp> = Meta<TCmp>,
> = ReturnType<typeof buildContext<TCmp, TMeta>>;

function createStoryRendererContext<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>(): void {
  const ctx = buildContext<TCmp, TMeta>({
    currentStoryExportName: undefined,
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoryRenderer<
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>() {
  if (!hasContext(CONTEXT_KEY)) {
    createStoryRendererContext<TCmp, TMeta>();
  }

  return getContext<StoryRendererContext<TCmp, TMeta>>(CONTEXT_KEY);
}

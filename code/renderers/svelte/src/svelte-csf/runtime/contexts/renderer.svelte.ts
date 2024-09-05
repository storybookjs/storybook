import { getContext, hasContext, setContext } from 'svelte';

import type { Cmp, Meta, StoryAnnotations, StoryContext } from '#types';
import type { Args } from '@storybook/types';

const CONTEXT_KEY = 'storybook-story-renderer-context';

interface ContextProps<TOverrideArgs extends Args, TCmp extends Cmp, TMeta extends Meta<TCmp>> {
  currentStoryExportName: string | undefined;
  args: NonNullable<StoryAnnotations<TCmp, TMeta>['args']>;
  storyContext: StoryContext<TCmp, TMeta>;
}

function buildContext<TOverrideArgs extends Args, TCmp extends Cmp, TMeta extends Meta<TCmp>>(
  props: ContextProps<TOverrideArgs, TCmp, TMeta>
) {
  let currentStoryExportName = $state(props.currentStoryExportName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);

  function set(props: ContextProps<TOverrideArgs, TCmp, TMeta>) {
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
  TOverrideArgs extends Args = Args,
  TCmp extends Cmp = Cmp,
  TMeta extends Meta<TCmp> = Meta<TCmp>,
> = ReturnType<typeof buildContext<TOverrideArgs, TCmp, TMeta>>;

function createStoryRendererContext<
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>(): void {
  const ctx = buildContext<TOverrideArgs, TCmp, TMeta>({
    currentStoryExportName: undefined,
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    args: {},
    // @ts-expect-error FIXME: I don't know how to satisfy this one
    storyContext: {},
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoryRenderer<
  TOverrideArgs extends Args,
  TCmp extends Cmp,
  TMeta extends Meta<TCmp>,
>() {
  if (!hasContext(CONTEXT_KEY)) {
    createStoryRendererContext<TOverrideArgs, TCmp, TMeta>();
  }

  return getContext<StoryRendererContext<TOverrideArgs, TCmp, TMeta>>(CONTEXT_KEY);
}

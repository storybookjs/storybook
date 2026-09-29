// Types: see the .d.ts file next to this one.
import { getContext, hasContext, setContext } from 'svelte';

const CONTEXT_KEY = 'storybook-story-renderer-context';

function buildContext(props) {
  let currentStoryExportName = $state(props.currentStoryExportName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);
  let metaRenderSnippet = $state(props.metaRenderSnippet);

  function set(props) {
    currentStoryExportName = props.currentStoryExportName;
    args = props.args;
    storyContext = props.storyContext;
    metaRenderSnippet = props.metaRenderSnippet;
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
    get metaRenderSnippet() {
      return metaRenderSnippet;
    },
    set,
  };
}

function createStoryRendererContext() {
  const ctx = buildContext({
    currentStoryExportName: undefined,
    args: {},
    storyContext: {},
  });

  setContext(CONTEXT_KEY, ctx);
}

export function useStoryRenderer() {
  if (!hasContext(CONTEXT_KEY)) {
    createStoryRendererContext();
  }

  return getContext(CONTEXT_KEY);
}

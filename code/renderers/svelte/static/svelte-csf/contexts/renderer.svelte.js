import { getContext, hasContext, setContext } from 'svelte';

/**
 * @import { Cmp, StoryRendererContext, StoryRendererContextProps } from '../../../src/svelte-csf/types.ts'
 */

const CONTEXT_KEY = 'storybook-story-renderer-context';

/**
 * @template {Cmp} TCmp
 * @param {StoryRendererContextProps<TCmp>} props
 * @returns {StoryRendererContext<TCmp>}
 */
function buildContext(props) {
  let currentStoryExportName = $state(props.currentStoryExportName);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);
  let metaRenderSnippet = $state(props.metaRenderSnippet);

  /** @param {StoryRendererContextProps<TCmp>} props */
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

/**
 * @template {Cmp} TCmp
 * @returns {StoryRendererContext<TCmp>}
 */
export function useStoryRenderer() {
  if (!hasContext(CONTEXT_KEY)) {
    createStoryRendererContext();
  }

  return getContext(CONTEXT_KEY);
}

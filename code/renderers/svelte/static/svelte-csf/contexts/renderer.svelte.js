// @ts-check
import { getContext, hasContext, setContext } from 'svelte';

/**
 * @import { Cmp, StoryContext, StoryRendererContext, StoryRendererContextProps } from '@storybook/svelte/internal/svelte-csf/component-helpers'
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

/**
 * @template {Cmp} TCmp
 * @returns {void}
 */
function createStoryRendererContext() {
  const ctx = buildContext({
    currentStoryExportName: undefined,
    args: {},
    // The renderer sets the real story context before any story reads it
    storyContext: /** @type {StoryContext<TCmp>} */ ({}),
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

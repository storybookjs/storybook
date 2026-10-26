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
  let contentExportName = $state(props.contentExportName);
  let playExportName = $state(props.playExportName);
  let asChildExportName = $state(props.asChildExportName);
  let asChild = $state(props.asChild);
  let args = $state(props.args);
  let storyContext = $state(props.storyContext);
  let metaRenderSnippet = $state(props.metaRenderSnippet);

  /** @param {StoryRendererContextProps<TCmp>} props */
  function set(props) {
    contentExportName = props.contentExportName;
    playExportName = props.playExportName;
    asChildExportName = props.asChildExportName;
    asChild = props.asChild;
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
    get contentExportName() {
      return contentExportName;
    },
    get playExportName() {
      return playExportName;
    },
    get asChildExportName() {
      return asChildExportName;
    },
    get asChild() {
      return asChild;
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
    contentExportName: undefined,
    playExportName: undefined,
    asChildExportName: undefined,
    asChild: false,
    args: {},
    // The renderer sets the real story context before any story reads it
    storyContext: /** @type {StoryContext<Record<string, any>>} */ ({}),
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

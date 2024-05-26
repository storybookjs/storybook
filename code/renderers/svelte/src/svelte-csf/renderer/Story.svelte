<script lang="ts" generics="TMeta extends Meta">
  import type { Meta, StoryObj, StoryContext } from '@storybook/svelte';
  import type { Snippet } from 'svelte';

  import { useStoriesExtractor, useStoryRenderer, useStoriesTemplate } from './contexts.svelte.js';

  type Props = {
    /**
     * The content to render in the story, either as:
     * 1. A snippet taking args and storyContext as parameters
     * 2. Static markup
     * Can be omitted if a default template is set with setTemplate() 
     * 
     */
    children?: Snippet<[StoryObj<TMeta>["args"], StoryContext<TMeta["args"]>]>;
    /**
    * Id of the story.
    *
    * Optional, auto-generated from name if not specified.
    */
    id?: string;
    /**
    * Name of the story.
    */
    name: string;
    /**
     * @deprecrated
     * Use `tags={['autodocs']}` instead.
     */
    autodocs?: never;
    /**
     * WARNING: This is under consideration to be revamped.
     * Ref: https://github.com/storybookjs/addon-svelte-csf/pull/181#issuecomment-2130744977
     *
     * Specify which sources should be shown.
     *
     * By default, sources for an args story are auto-generated.
     * If source is true, then the source of the story will be used instead.
     * If source is a string, it replaces the source of the story.
     */
    source?: boolean | string;
  } & StoryObj<TMeta>;

  const { children, name, id, play, ...restProps }: Props = $props();

  const extractor = useStoriesExtractor<TMeta>();
  const renderer = useStoryRenderer<TMeta>();
  const template = useStoriesTemplate<TMeta>();

  const isCurrentlyViewed = $derived(!extractor.isExtracting && renderer.currentStoryName === name);

  if (extractor.isExtracting) {
    extractor.register({ ...restProps, name, play } as StoryObj<TMeta>);
  }

  function injectIntoPlayFunction(storyContext: typeof renderer.storyContext, playToInject: typeof play) {
    if (playToInject && storyContext.playFunction) {
      storyContext.playFunction.__play = playToInject;
    }
  }

  $effect(() => {
    if (isCurrentlyViewed) {
      injectIntoPlayFunction(renderer.storyContext, play);
    }
  });
</script>

{#if isCurrentlyViewed}
  {#if children}
    {@render children(renderer.args, renderer.storyContext)}
  {:else if template}
    {@render template(renderer.args, renderer.storyContext)}
  {/if}
{/if}

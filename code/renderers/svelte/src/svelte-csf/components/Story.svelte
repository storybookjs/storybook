<script lang="ts" generics="Component extends SvelteComponent">
  import type { StoryObj } from '@storybook/svelte';
  import type { Snippet, SvelteComponent } from 'svelte';

  import type { Template } from '../index.js';
  import {useStoriesExtractor, useStoryRenderer, useStoriesTemplate } from './context.svelte.js';

  type Props = StoryObj<Component> & {
    children?: Snippet<[Template<Component>]>;
    /**
    * Id of the story.
    *
    * Optional, auto-generated from name if not specified.
    */
    id?: string;
    /**
    * Name of the story.
    * @default "Default"
    */
    name?: string;
    /**
     * @deprecrated
     * Use `tags={['autodocs']}` instead.
     */
    autodocs?: never;
    /**
     *
     * Specify which sources should be shown.
     *
     * By default, sources for an args story are auto-generated.
     * If source is true, then the source of the story will be used instead.
     * If source is a string, it replaces the source of the story.
     */
    source?: boolean | string;
  }

  const { children, name = "Default",  id, play, ...restProps }:Props = $props();

  const extractor = useStoriesExtractor<Component>();
  const renderer = useStoryRenderer<Component>();
  const storiesTemplate = useStoriesTemplate<Component>();

  const isCurrentlyViewed = $derived(!extractor.isExtracting && renderer.currentStoryName === name);

  if (extractor.isExtracting) {
    extractor.register({ ...restProps, name, play } as StoryObj<Component>);
  }

  function injectIntoPlayFunction(storyContext_: typeof renderer.storyContext, play_: typeof play) {
    if (play_ && storyContext_.playFunction) {
      storyContext_.playFunction.__play = play_;
    }
  }

  $effect(() => {
    if (isCurrentlyViewed) {
      injectIntoPlayFunction(renderer.storyContext, play);
    }
  });

  const template = $derived({ args: renderer.args, context: renderer.storyContext });
</script>

{#if isCurrentlyViewed}
  {#if children}
    {@render children(template)}
  {:else if storiesTemplate}
    {@render storiesTemplate(template)}
  {/if}
{/if}

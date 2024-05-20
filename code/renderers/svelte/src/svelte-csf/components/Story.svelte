<script lang="ts" generics="M extends Meta">
  import type { Meta, StoryObj } from '@storybook/svelte';
  import type { Snippet } from 'svelte';

  import type { Template } from '../index.js';
  import {useStoriesExtractor, useStoryRenderer, useStoriesTemplate } from './context.svelte.js';

  type Props = {
    children?: Snippet<[Template<M>]>;
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
    // TODO: Discuss if this is still neeeded
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

  const { children, name = "Default",  id, play, ...restProps }:Props & StoryObj<M> = $props();

  const extractor = useStoriesExtractor<M>();
  const renderer = useStoryRenderer<M>();
  const storiesTemplate = useStoriesTemplate<M>();

  const isCurrentlyViewed = $derived(!extractor.isExtracting && renderer.currentStoryName === name);

  if (extractor.isExtracting) {
    // @ts-expect-error FIXME: No idea how to satisfy this one, I could've missed something
    extractor.register({ ...restProps, name, play });
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

  const templateProps = $derived({ args: renderer.args, context: renderer.storyContext });
</script>

{#if isCurrentlyViewed}
  {#if children}
    {@render children(templateProps)}
  {:else if storiesTemplate}
    {@render storiesTemplate(templateProps)}
  {/if}
{/if}

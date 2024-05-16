<script lang="ts" generics="Component extends SvelteComponent">
  import type { ComponentAnnotations } from '@storybook/types';
  import type {  Meta, StoryContext, StoryObj, SvelteRenderer } from '@storybook/svelte';
  import type { ComponentProps, Snippet, SvelteComponent } from 'svelte';

  import {useStoriesExtractor, useStoryRenderer, useStoryChildrenTemplate } from './context.svelte.js';

  type Props = StoryObj<Component> & {
    meta?: Meta<Component>;
    children?: Snippet<[ComponentAnnotations<SvelteRenderer<Component>> & { context: StoryContext<ComponentProps<Component>> }]>;
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

  const { children, name = "Default",  id,  play, ...restProps }:Props = $props();

  const extractor = useStoriesExtractor<Component>();
  const renderer = useStoryRenderer<Component>();
  const childrenTemplate = useStoryChildrenTemplate<Component>();

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

  const childrenProps = $derived({...renderer.componentAnnotations, context: renderer.storyContext});
</script>

{#if isCurrentlyViewed}
  {#if children}
    {@render children(childrenProps)}
  {:else if childrenTemplate}
    {@render childrenTemplate(childrenProps)}
  {/if}
{/if}

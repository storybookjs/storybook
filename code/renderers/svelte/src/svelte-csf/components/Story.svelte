<script lang="ts" generics="M extends Meta">
  import type { Meta, StoryObj, StoryContext } from '@storybook/svelte';
  import type { Snippet } from 'svelte';

  import { useStoriesExtractor, useStoryRenderer, useStoriesTemplate } from './context.svelte.js';

  type Props = {
    children?: Snippet<[StoryObj<M>["args"], StoryContext<M["args"]>]>;
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
  } & StoryObj<M>;

  const { children, name = "Default", id, play, ...restProps }: Props = $props();

  const extractor = useStoriesExtractor<M>();
  const renderer = useStoryRenderer<M>();
  const template = useStoriesTemplate<M>();

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
</script>

{#if isCurrentlyViewed}
  {#if children}
    {@render children(renderer.args, renderer.storyContext)}
  {:else if template}
    {@render template(renderer.args, renderer.storyContext)}
  {/if}
{/if}

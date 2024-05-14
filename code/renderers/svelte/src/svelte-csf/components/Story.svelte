<script lang="ts" generics="Component extends SvelteComponent">
  import type { ComponentAnnotations } from '@storybook/types';
  import type {  Meta, StoryContext, SvelteRenderer } from '@storybook/svelte';
  import type { ComponentProps, Snippet, SvelteComponent } from 'svelte';

  import {type AddonStoryObj, useStoriesExtractorContext, useStoryRendererContext } from './context.svelte.js';

  type Props = Omit<AddonStoryObj<Component>, "name"> & {
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
    * Id of the template used by this story.
    *
    * Optional. Used if the story has no body.
    * If not specified, use the 'default' template.
    */
    template?: string;
    /**
    * TODO: Figure out if this feature is still needed.
    *
    * Specify which sources should be shown.
    *
    * By default, sources for an args story are auto-generated.
    * If source is true, then the source of the story will be used instead.
    * If source is a string, it replaces the source of the story.
    */
    // source?: boolean | string;
  }

  const { children, name = "Default", play, template, ...restProps }:Props = $props();
  const templateId = !children ? (template ?? 'default') : undefined;

  const extractorContext = useStoriesExtractorContext<Component>();
  const rendererContext = useStoryRendererContext<Component>();
  const { componentAnnotations, storyContext, storyName } = rendererContext;

  const render = $derived(!extractorContext.isExtracting && storyName === name);

  if (extractorContext.isExtracting) {
    // FIXME: This is challenging, not sure why TypeScript is not happy?
    extractorContext.register.story({ ...restProps, name, play, templateId });
  }

  function injectIntoPlayFunction(storyContext_: typeof storyContext, play_: typeof play) {
    if (play_ && storyContext_.playFunction) {
      storyContext_.playFunction.__play = play_;
    }
  }

  $effect(() => {
    if (render) {
      injectIntoPlayFunction(storyContext, play);
    }
  });
</script>

{#if render && children}
  {@render children({ ...componentAnnotations, context: storyContext })}
{/if}

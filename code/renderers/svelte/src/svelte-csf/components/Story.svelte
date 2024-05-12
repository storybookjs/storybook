<script lang="ts" generics="Component extends SvelteComponent">
  import type {  StoryContext } from '@storybook/svelte';
  import type { ComponentProps, Snippet, SvelteComponent } from 'svelte';

  import {type AddonStoryObj, useContext, getRenderContext } from './context.js';

  type Props = Omit<AddonStoryObj<Component>, "name"> & {
    children?: Snippet<[ComponentProps<Component> & { context: StoryContext<ComponentProps<Component>> }]>;
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

  const context = useContext<Component>();

  const templateId = !children ? template ? template : 'default' : undefined;

  // FIXME: This is challenging, not sure why TypeScript is not happy.
  context.registerStory({ ...restProps, name, play, templateId });

  const { argsStore, storyContextStore, currentStoryName } = getRenderContext<Component>();

  const render = $derived(context.render && $currentStoryName === name);


  // FIXME: Come on TypeScript :(
  function injectIntoPlayFunction(storyRenderContextStore: typeof $storyContextStore, play: Props["play"]) {
    console.log({ play, storyRenderContextStore });
    if (play && storyRenderContextStore.playFunction) {
      storyRenderContextStore.playFunction.__play = play;
    }
  }

  $effect(() => {
    if (render) {
      injectIntoPlayFunction($storyContextStore, play);
    }
  });
</script>

{#if render && children}
  {@render children({ ...$argsStore, context: $storyContextStore })}
{/if}

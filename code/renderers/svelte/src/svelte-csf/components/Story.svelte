<script lang="ts" generics="Component extends SvelteComponent">
  import type {  Meta, StoryContext } from '@storybook/svelte';
  import type { ComponentProps, Snippet, SvelteComponent } from 'svelte';

  import {type AddonStoryObj, useStoryRenderContext, useStoriesRegistrationContext } from './context.svelte.js';

  type Props = Omit<AddonStoryObj<Component>, "name"> & {
    meta?: Meta<Component>;
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

  const storiesRegistrationContext = useStoriesRegistrationContext<Component>();
  const storyRenderContext = useStoryRenderContext<Component>();

  $inspect({ storiesRegistrationContext, storyRenderContext }).with(console.trace);

  const { args, storyContext, storyName } = storyRenderContext;

  const render = $derived(storiesRegistrationContext.render && storyName === name);

  const templateId = !children ? (template ?? 'default') : undefined;

  // FIXME: This is challenging, not sure why TypeScript is not happy.
  storiesRegistrationContext.register.story({ ...restProps, name, play, templateId });

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
  {@render children({ ...args, context: storyContext })}
{/if}

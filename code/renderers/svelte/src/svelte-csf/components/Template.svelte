<script lang="ts" generics="Component extends SvelteComponent">
  import type { StoryContext } from '@storybook/svelte';
  import type { ComponentProps, Snippet, SvelteComponent } from 'svelte';

  import { type AddonTemplateObj, useStoriesRegistrationContext, useStoryRenderContext } from './context.svelte.js';

  type Props = Omit<AddonTemplateObj<Component>, "id"> & {
    children: Snippet<[ComponentProps<Component> & { context: StoryContext<ComponentProps<Component>> }]>;
    /**
    * Id of the template.
    *
    * Optional. Uses 'default' if not specified.
    */
    id?: string;
  }

  const { children, id = 'default', ...restProps }: Props = $props();

  const storiesRegistrationContext = useStoriesRegistrationContext<Component>();
  const storyRenderContext = useStoryRenderContext<Component>();

  $inspect({ storiesRegistrationContext, storyRenderContext }).with(console.trace);

  // FIXME: This is challenging, not sure why TypeScript is not happy.
  storiesRegistrationContext.register.template({ ...restProps, id });

  const { args, storyContext, templateId } = storyRenderContext;

  const render = $derived(storiesRegistrationContext.render && templateId === id);
</script>

{#if render}
  {@render children({ ...args,  context: storyContext })}
{/if}

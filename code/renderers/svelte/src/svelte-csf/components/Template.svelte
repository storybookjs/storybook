<script lang="ts" generics="Component extends SvelteComponent">
  import type { StoryContext } from '@storybook/svelte';
  import type { ComponentProps, Snippet, SvelteComponent } from 'svelte';

  import { type AddonTemplateObj, useContext, getRenderContext } from './context.js';

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

  const context = useContext<Component>();

  // FIXME: This is challenging, not sure why TypeScript is not happy.
  context.registerTemplate({ ...restProps, id });

  const { argsStore, storyContextStore, currentTemplateId } = getRenderContext<Component>();

  const render = $derived(context.render && $currentTemplateId === id);
</script>

{#if render}
  {@render children({ ...$argsStore,  context: $storyContextStore })}
{/if}

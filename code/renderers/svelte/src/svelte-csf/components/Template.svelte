<script lang="ts" generics="Component extends SvelteComponent">
  import type { ComponentAnnotations } from '@storybook/types';
  import type { StoryContext, SvelteRenderer } from '@storybook/svelte';
  import type { ComponentProps, Snippet, SvelteComponent } from 'svelte';

  import { type AddonTemplateObj, useStoriesExtractorContext, useStoryRendererContext } from './context.svelte.js';

  type Props = Omit<AddonTemplateObj<Component>, "id"> & {
    children: Snippet<[ComponentAnnotations<SvelteRenderer<Component>> & { context: StoryContext<ComponentProps<Component>> }]>;
    /**
    * Id of the template.
    *
    * Optional. Uses 'default' if not specified.
    */
    id?: string;
  }

  const { children, id = 'default', ...restProps }: Props = $props();

  const extractorContext = useStoriesExtractorContext<Component>();
  const rendererContext = useStoryRendererContext<Component>();

  if (extractorContext.isExtracting) {
    // FIXME: This is challenging, not sure why TypeScript is not happy.
    extractorContext.register.template({ ...restProps, id });
  }
  const { componentAnnotations, storyContext, templateId } = rendererContext;

  const render = $derived(!extractorContext.isExtracting && templateId === id);
</script>

{#if render}
  {@render children({ ...componentAnnotations,  context: storyContext })}
{/if}

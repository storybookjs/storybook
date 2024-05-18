<script lang="ts" generics="Component extends SvelteComponent">
  import type { StoryContext } from '@storybook/svelte';
  import type { StoryName } from '@storybook/types';
  import type { ComponentProps, ComponentType, SvelteComponent } from 'svelte';

  import { useStoryRenderer } from './context.svelte.js';

  type Props = {
    Stories: Component extends SvelteComponent ? ComponentType<SvelteComponent> : never;
    storyName: StoryName;
    args: ComponentProps<Component>;
    storyContext: StoryContext<ComponentProps<Component>>;
  };

  let { Stories, storyName, args, storyContext }: Props = $props();
  const context = useStoryRenderer<Component>();

  $effect(() => {
    context.set({
      currentStoryName: storyName,
      args,
      storyContext,
    });
  });
</script>

<svelte:component this={Stories} />

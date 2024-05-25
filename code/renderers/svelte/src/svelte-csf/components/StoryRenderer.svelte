<script lang="ts" generics="TMeta extends Meta">
  import type { Meta, StoryContext, StoryObj } from '@storybook/svelte';
  import type { StoryName } from '@storybook/types';
  import type { ComponentType } from 'svelte';

  import { useStoryRenderer } from './context.svelte.js';

  type Props = {
    Stories: ComponentType;
    storyName: StoryName;
    args: StoryObj<TMeta>['args'];
    storyContext: StoryContext<TMeta['args']>;
  };

  let { Stories, storyName, args, storyContext }: Props = $props();

  const context = useStoryRenderer<TMeta>();

  $effect(() => {
    context.set({
      currentStoryName: storyName,
      args,
      storyContext,
    });
  });
</script>

<svelte:component this={Stories} />

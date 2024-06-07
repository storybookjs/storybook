<script lang="ts" generics="TMeta extends Meta">
  import type { Meta, StoryContext, StoryObj } from '@storybook/svelte';
  import type { ComponentType } from 'svelte';

  import { useStoryRenderer } from './contexts/renderer.svelte.js';
  import { emitCode } from './emit-code.js';

  type Props = {
    Stories: ComponentType;
    exportName: string;
    args: StoryObj<TMeta>['args'];
    storyContext: StoryContext<TMeta['args']>;
  };

  let { Stories, exportName, args, storyContext, code }: Props = $props();

  const context = useStoryRenderer<TMeta>();

  $effect(() => {
    context.set({
      currentStoryExportName: exportName,
      args,
      storyContext,
    });
  });

  $effect(() => {
    // TODO: optimize effect params here, we don't read the whole context in reality
    emitCode({ args, storyContext });
  });
</script>

<svelte:component this={Stories} />

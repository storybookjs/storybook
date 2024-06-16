<script lang="ts" generics="const TMeta extends Meta = Meta">
  import type { Component } from 'svelte';

  import { useStoryRenderer } from '#runtime/contexts/renderer.svelte';
  import { emitCode } from '#runtime/emit-code';

  import type { Meta, StoryCmpProps, StoryContext } from '#types';

  type Props = {
    Stories: Component;
    exportName: string;
    args: StoryCmpProps['args'];
    storyContext: StoryContext<TMeta['args']>;
  };

  let { Stories, exportName, args, storyContext }: Props = $props();

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

<script lang="ts">
  import type { Component } from 'svelte';

  import { useStoryRenderer } from './contexts/renderer.svelte';
  import { emitCode } from './emit-code';

  import type { Cmp, StoryAnnotations, StoryContext } from '../types';

  type Props = {
    Stories: Component;
    exportName: string;
    args: NonNullable<StoryAnnotations<Cmp>['args']>;
    storyContext: StoryContext<Cmp>;
  };

  let { Stories, exportName, args, storyContext }: Props = $props();

  const context = useStoryRenderer<Cmp>();

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

<Stories />

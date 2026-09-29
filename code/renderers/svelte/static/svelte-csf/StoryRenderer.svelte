<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  import { useStoryRenderer } from '@storybook/svelte/internal/svelte-csf/contexts/renderer';
  import { emitCode } from '@storybook/svelte/internal/svelte-csf/component-helpers';

  import type { Cmp, StoryContext } from '../../src/svelte-csf/types.ts';

  type Props = {
    Stories: Component;
    exportName: string;
    args: Record<string, any>;
    storyContext: StoryContext<Cmp>;
    metaRenderSnippet?: Snippet;
  };

  let { Stories, exportName, args, storyContext, metaRenderSnippet }: Props = $props();

  const context = useStoryRenderer<Cmp>();

  $effect(() => {
    context.set({
      currentStoryExportName: exportName,
      args,
      storyContext,
      metaRenderSnippet,
    });
  });

  $effect(() => {
    // TODO: optimize effect params here, we don't read the whole context in reality
    emitCode({ args, storyContext });
  });
</script>

<Stories />

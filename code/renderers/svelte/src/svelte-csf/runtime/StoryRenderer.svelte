<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  import { useStoryRenderer } from './contexts/renderer.svelte';
  import { emitCode } from './emit-code.js';

  import type { Cmp, StoryAnnotations, StoryContext } from '../types.js';

  type Props = {
    Stories: Component;
    exportName: string;
    args: NonNullable<StoryAnnotations<Cmp>['args']>;
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

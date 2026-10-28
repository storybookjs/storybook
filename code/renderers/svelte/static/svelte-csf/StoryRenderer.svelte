<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  import { useStoryRenderer } from '@storybook/svelte/internal/svelte-csf/contexts/renderer';
  import { emitCode } from '@storybook/svelte/internal/svelte-csf/component-helpers';

  import type { Cmp, StoryContext } from '@storybook/svelte/internal/svelte-csf/component-helpers';

  type Props = {
    Stories: Component;
    contentExportName: string;
    playExportName: string | undefined;
    asChildExportName: string | undefined;
    asChild: boolean;
    args: Record<string, any>;
    storyContext: StoryContext<Record<string, any>>;
    metaRenderSnippet?: Snippet;
  };

  let {
    Stories,
    contentExportName,
    playExportName,
    asChildExportName,
    asChild,
    args,
    storyContext,
    metaRenderSnippet,
  }: Props = $props();

  const context = useStoryRenderer<Cmp>();

  $effect(() => {
    context.set({
      contentExportName,
      playExportName,
      asChildExportName,
      asChild,
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

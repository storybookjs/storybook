<script lang="ts">
  import type { Component } from 'svelte';

  import { useStoryRenderer } from '#runtime/contexts/renderer.svelte';
  import { emitCode } from '#runtime/emit-code';

  import type { Cmp, Meta, StoryAnnotations, StoryContext } from '#types';
  import type { EmptyObject } from 'type-fest';

  type Props = {
    Stories: Component;
    exportName: string;
    args: NonNullable<StoryAnnotations<Cmp, Meta<Cmp>>['args']>;
    storyContext: StoryContext<Cmp, Meta<Cmp>>;
  };

  let { Stories, exportName, args, storyContext }: Props = $props();

  const context = useStoryRenderer<EmptyObject, Cmp, Meta<Cmp>>();

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

<script lang="ts">
  import type { Component } from 'svelte';

  import { useStoryRenderer } from '#runtime/contexts/renderer.svelte';
  import { emitCode } from '#runtime/emit-code';

  import type { CmpOrArgs, StoryAnnotations, StoryContext } from '#types';

  type Props = {
    Stories: Component;
    exportName: string;
    args: NonNullable<StoryAnnotations<CmpOrArgs>['args']>;
    storyContext: StoryContext<CmpOrArgs>;
  };

  let { Stories, exportName, args, storyContext }: Props = $props();

  const context = useStoryRenderer<CmpOrArgs>();

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

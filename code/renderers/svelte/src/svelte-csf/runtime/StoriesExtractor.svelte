<script lang="ts" generics="Component extends SvelteComponent = SvelteComponent">
  import type { ComponentType, SvelteComponent } from 'svelte';

  import type { Meta } from '#types';

  import {
    type StoriesRepository,
    createStoriesExtractorContext,
  } from '#runtime/contexts/extractor.svelte';

  interface Props {
    Stories: ComponentType;
    repository: () => StoriesRepository<Meta<Component>>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<svelte:component this={Stories} />

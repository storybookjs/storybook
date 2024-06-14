<script lang="ts" generics="Cmp extends Component = Component">
  import type { Component } from 'svelte';

  import type { Meta, StoryCmpProps } from '#types';

  import {
    type StoriesRepository,
    createStoriesExtractorContext,
  } from '#runtime/contexts/extractor.svelte';

  interface Props {
    Stories: Component;
    repository: () => StoriesRepository<StoryCmpProps>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<svelte:component this={Stories} />

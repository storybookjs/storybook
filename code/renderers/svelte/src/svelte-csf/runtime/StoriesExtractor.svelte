<script lang="ts">
  import type { Component } from 'svelte';

  import type { CmpOrArgs } from '#types';

  import {
    type StoriesRepository,
    createStoriesExtractorContext,
  } from '#runtime/contexts/extractor.svelte';

  interface Props {
    Stories: Component;
    repository: () => StoriesRepository<CmpOrArgs>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<Stories />

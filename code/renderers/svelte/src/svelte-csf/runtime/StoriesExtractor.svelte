<script lang="ts">
  import type { Component } from 'svelte';
  import type { EmptyObject } from 'type-fest';

  import type { Cmp, Meta } from '#types';

  import {
    type StoriesRepository,
    createStoriesExtractorContext,
  } from '#runtime/contexts/extractor.svelte';

  interface Props {
    Stories: Component;
    repository: () => StoriesRepository<EmptyObject, Cmp, Meta<Cmp>>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<Stories />

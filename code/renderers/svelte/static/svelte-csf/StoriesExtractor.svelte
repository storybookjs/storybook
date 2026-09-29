<script lang="ts">
  import type { Component } from 'svelte';

  import type { Cmp } from '../types.js';

  import {
    type StoriesRepository,
    createStoriesExtractorContext,
  } from './contexts/extractor.svelte';

  interface Props {
    Stories: Component;
    repository: () => StoriesRepository<Cmp>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<Stories />

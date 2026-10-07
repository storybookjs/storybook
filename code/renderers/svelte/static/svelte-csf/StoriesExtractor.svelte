<script lang="ts">
  import type { Component } from 'svelte';

  import type { Cmp, StoriesRepository } from '@storybook/svelte/internal/svelte-csf/component-helpers';

  import { createStoriesExtractorContext } from '@storybook/svelte/internal/svelte-csf/contexts/extractor';

  interface Props {
    Stories: Component;
    repository: () => StoriesRepository<Cmp>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<Stories />

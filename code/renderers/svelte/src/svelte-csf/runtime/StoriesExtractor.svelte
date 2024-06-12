<script lang="ts" generics="Component extends SvelteComponent = SvelteComponent">
  import type { Meta } from '@storybook/svelte';
  import type { ComponentType, SvelteComponent } from 'svelte';

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

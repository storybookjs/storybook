<script lang="ts" generics="Component extends SvelteComponent">
  import type { ComponentType, SvelteComponent } from 'svelte';

  import { type StoriesRepository, createStoriesExtractorContext } from './context.svelte.js';

  interface Props {
    Stories: Component extends SvelteComponent ? ComponentType<Component> : never;
    repository: () => StoriesRepository<Component>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<svelte:component this={Stories} />

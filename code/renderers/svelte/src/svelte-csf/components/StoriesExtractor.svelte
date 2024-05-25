<script lang="ts" generics="Component extends SvelteComponent">
  import type { Meta } from '@storybook/svelte';
  import type { ComponentType, SvelteComponent } from 'svelte';

  import { type StoriesRepository, createStoriesExtractorContext } from './contexts.svelte.js';

  interface Props {
    Stories: Component extends SvelteComponent ? ComponentType<Component> : never;
    repository: () => StoriesRepository<Meta<Component>>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());
</script>

<svelte:component this={Stories} />

<script lang="ts" generics="Component extends SvelteComponent">
  import type { ComponentType, SvelteComponent } from 'svelte';

  import { type StoriesRepository, createStoriesRegistrationContext } from './context.svelte.js';

  interface Props {
    Stories: ComponentType<Component>;
    repository: () => StoriesRepository<Component>;
  }

  const { Stories, repository }: Props = $props();

  $inspect({ Stories, repository: repository() }).with(console.trace);

  createStoriesRegistrationContext(repository());
</script>

<svelte:component this={Stories} />

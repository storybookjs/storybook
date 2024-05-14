<script lang="ts" generics="Component extends SvelteComponent">
  import type { ComponentProps, ComponentType, SvelteComponent } from 'svelte';

  import { type StoriesRepository, createStoriesExtractorContext } from './context.svelte.js';

  interface Props {
    Stories: Component;
    repository: () => StoriesRepository<Component>;
  }

  const { Stories, repository }: Props = $props();

  createStoriesExtractorContext(repository());

  // FIXME:
  // This is a temporary workaround,
  // `<svelte:component>` requires to pass the props,
  // but we don't need to render with props(?)
  const p = {} as ComponentProps<typeof Stories>;
</script>

<!-- FIXME: Possibly upstream issue, needs inspection -->
<svelte:component this={Stories} {...p} />

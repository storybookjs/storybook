<script lang="ts" generics="Component extends SvelteComponent">
  import type { ComponentType, SvelteComponent } from 'svelte';

  import { createRegistrationContext, type Repositories } from './context.js';

  interface Props {
    Stories: ComponentType<Component>;
    repositories: () => Repositories<Component>;
  }

  const { Stories, repositories }: Props = $props();

  // $inspect({ Stories, repositories: repositories() }).with(console.trace);

  createRegistrationContext(repositories());
</script>

<svelte:component this={Stories} />

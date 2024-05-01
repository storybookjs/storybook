<script>
  import { createRegistrationContext } from './context';

  const { Stories, repositories } = $props();

  createRegistrationContext(repositories());
</script>

<svelte:component this={Stories} />

<script>
  import { createRegistrationContext } from './context';

  const { Stories, repositories } = $props();

  console.log({ Stories, repositories });
  createRegistrationContext(repositories());
</script>

<svelte:component this={Stories} />

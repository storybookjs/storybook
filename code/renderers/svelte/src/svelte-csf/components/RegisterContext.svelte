<script>
  import { createRegistrationContext } from './context';

  export let Stories;
  export let repositories;

  createRegistrationContext(repositories);

</script>

<svelte:component this={Stories} />

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ change: number }>();
</script>

<button on:click={() => dispatch('change', 1)}>Change</button>

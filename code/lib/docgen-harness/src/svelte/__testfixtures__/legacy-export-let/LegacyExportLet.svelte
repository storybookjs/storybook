<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Legacy label text. */
  export let label = 'Legacy';
  /** Legacy count. */
  export let count: number;

  const dispatch = createEventDispatcher<{ change: string }>();
</script>

<button on:click={() => dispatch('change', label)}>
  {label} {count}
  <slot />
</button>
<slot name="footer" />

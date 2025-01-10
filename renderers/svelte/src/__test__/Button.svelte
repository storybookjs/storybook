<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let disabled: boolean;
  export let label: string;

  const dispatch = createEventDispatcher();
</script>

<button on:click={(e) => dispatch('clicked', e)} on:dblclick on:mousemove {disabled}>
  {label}
</button>

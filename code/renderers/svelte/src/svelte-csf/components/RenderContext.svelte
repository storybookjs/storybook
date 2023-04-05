<script>
  /**
   * @component
   * @wrapper
   */
  import { createRenderContext } from './context';
  import { tick } from 'svelte';

  export let Stories;
  let exporttime = 0;

  $: {
    createRenderContext($$props);
  }
</script>

{#key $$props.args}
  <svelte:component this={Stories} />
{/key}

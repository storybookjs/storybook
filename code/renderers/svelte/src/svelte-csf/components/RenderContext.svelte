<script>
  /**
   * @component
   * @wrapper
   */
  import { createRenderContext } from './context';

  export let Stories;

  createRenderContext($$props);
</script>

<svelte:component this={Stories}/>
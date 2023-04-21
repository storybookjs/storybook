<script>
  /**
   * @component
   * @wrapper
   */
  import { createRenderContext, setStoryRenderContext } from './context';

  export let Stories;
  export let args = {};
  export let storyContext = {};

  createRenderContext($$props);

  $: setStoryRenderContext(args, storyContext);
</script>

<svelte:component this={Stories} />

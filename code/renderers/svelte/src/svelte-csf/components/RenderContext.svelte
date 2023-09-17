<script>
  /**
   * @component
   * @wrapper
   */
  import { createRenderContext, setStoryRenderContext } from './context';

  export let Stories;
  export let args = {};
  export let storyContext = {};

  /** @type {import('svelte').SvelteComponent} */
  let instance;

  createRenderContext($$props);

  // events are static and don't need to be reactive
  const eventsFromArgTypes = Object.fromEntries(
    Object.entries(storyContext.argTypes)
      .filter(([k, v]) => v.action && args[k] != null)
      .map(([k, v]) => [v.action, args[k]])
  ); 

  $: setStoryRenderContext(args, storyContext);


  $: if (instance) {
    Object.entries(eventsFromArgTypes).forEach(([event, handler]) => instance.$on(event, handler));
  }

</script>

<svelte:component this={Stories} bind:this={instance}/>

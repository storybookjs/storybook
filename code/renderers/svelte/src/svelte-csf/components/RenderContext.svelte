<script>
  /**
   * @component
   * @wrapper
   */
  import { createRenderContext, setStoryRenderContext } from './context';

  let { Stories, storyContext = {}, args = {}, ...props } = $props();

  createRenderContext(props);

  // events are static and don't need to be reactive
  const events = Object.fromEntries(
    Object.entries(storyContext.argTypes)
      .filter(([k, v]) => v.action && args[k] != null)
      .map(([k, v]) => [v.action, args[k]])
  );

  $inspect(events, args, storyContext);

  $effect(() => setStoryRenderContext(args, storyContext))

</script>

<svelte:component this={Stories} {...events} />

<script>
  export let storyFn;

  let { Component: component, props } = storyFn();
</script>

<svelte:component this={component} {...props}/>
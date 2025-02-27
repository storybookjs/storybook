<script>
  const { 
    decorator: Decorator, 
    decoratorProps = {}, 
    component: Component, 
    props = {}
  } = $props();

  let instance = $state();
  let decoratorInstance = $state();
</script>

{#if Decorator}
  <Decorator {...decoratorProps} bind:this={decoratorInstance}>
    <Component {...props} bind:this={instance}/>
  </Decorator>
{:else}
  <Component {...props} bind:this={instance}/>
{/if}
<script>
  const { 
    decorator: Decorator, 
    decoratorProps = {}, 
    component: Component, 
    props = {}
  } = $props();
</script>

{#if Decorator}
  <Decorator {...decoratorProps} bind:this={decoratorInstance}>
    <Component {...props} bind:this={instance}/>
  </Decorator>
{:else}
  <Component {...props} bind:this={instance}/>
{/if}
<script>
  const { 
    decorator: Decorator, 
    decoratorProps = {}, 
    component: Component, 
    props = {}
  } = $props();

  /*
    Svelte Docgen will create argTypes for events with the name 'event_eventName'
    The Actions addon will convert these to args because they are type: 'action'
    We need to filter these args out so they are not passed to the component
  */
  let propsWithoutDocgenEvents = $derived(Object.fromEntries(
    Object.entries(props).filter(([key]) => !key.startsWith('event_'))
  ));

  let instance = $state();
  let decoratorInstance = $state();
</script>

{#if Decorator}
  <Decorator {...decoratorProps} bind:this={decoratorInstance}>
    <Component {...propsWithoutDocgenEvents} bind:this={instance}/>
  </Decorator>
{:else}
  <Component {...propsWithoutDocgenEvents} bind:this={instance}/>
{/if}
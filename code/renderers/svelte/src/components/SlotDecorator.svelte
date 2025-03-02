<script>
  export let decorator = undefined;
  export let Component;
  export let props = {};

  let instance;
  let decoratorInstance;
  
  /*
    Svelte Docgen will create argTypes for events with the name 'event_eventName'
    The Actions addon will convert these to args because they are type: 'action'
    We need to filter these args out so they are not passed to the component
  */
  let propsWithoutDocgenEvents;
  $: propsWithoutDocgenEvents = Object.fromEntries(
    Object.entries(props).filter(([key]) => !key.startsWith('event_'))
  );
</script>

{#if decorator}
  <svelte:component this={decorator.Component} {...decorator.props} bind:this={decoratorInstance}>
    <svelte:component this={Component} {...propsWithoutDocgenEvents} bind:this={instance} />
  </svelte:component>
{:else}
  <svelte:component this={Component} {...propsWithoutDocgenEvents} bind:this={instance} />
{/if}
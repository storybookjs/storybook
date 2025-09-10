<script>
  const { decorator, Component, props } = $props();

  /*
    Svelte Docgen will create argTypes for events with the name 'event_eventName'
    The Actions addon will convert these to args because they are type: 'action'
    We need to filter these args out so they are not passed to the component
  */
  let propsWithoutDocgenEvents = $derived(
    Object.fromEntries(Object.entries(props).filter(([key]) => !key.startsWith('event_')))
  );
</script>

{#if decorator}
  <decorator.Component {...decorator.props}>
    <Component {...propsWithoutDocgenEvents} />
  </decorator.Component>
{:else}
  <Component {...propsWithoutDocgenEvents} />
{/if}

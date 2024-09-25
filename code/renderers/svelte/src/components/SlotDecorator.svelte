<script>
  import { onMount } from 'svelte';
  import { VERSION } from 'svelte/compiler';

  export let decorator = undefined;
  export let Component;
  export let props = {};
  export let on = undefined;
  export let argTypes = undefined;

  let instance;
  let decoratorInstance;

  const svelteVersion = VERSION[0];
  
  /*
    Svelte Docgen will create argTypes for events with the name 'event_eventName'
    The Actions addon will convert these to args because they are type: 'action'
    We need to filter these args out so they are not passed to the component
  */
  let propsWithoutDocgenEvents;
  $: propsWithoutDocgenEvents = Object.fromEntries(
    Object.entries(props).filter(([key]) => !key.startsWith('event_'))
  );

  if (argTypes && svelteVersion < 5) {
    const eventsFromArgTypes = Object.fromEntries(
      Object.entries(argTypes)
        .filter(([key, value]) => value.action && props[key] != null)
        .map(([key, value]) => [value.action, props[key]])
    );
    // Attach Svelte event listeners in Svelte v4
    // In Svelte v5 this is not possible anymore as instances are no longer classes with $on() properties, so it will be a no-op
    onMount(() => {
      Object.entries({ ...eventsFromArgTypes, ...on }).forEach(([eventName, eventCallback]) => {
        // instance can be undefined if a decorator doesn't have a <slot/>
        const inst = instance ?? decoratorInstance;
        inst?.$on?.(eventName, eventCallback);
      });
    });
  }
</script>

{#if decorator}
  <svelte:component this={decorator.Component} {...decorator.props} bind:this={decoratorInstance}>
    <svelte:component this={Component} {...propsWithoutDocgenEvents} bind:this={instance} />
  </svelte:component>
{:else}
  <svelte:component this={Component} {...propsWithoutDocgenEvents} bind:this={instance} />
{/if}

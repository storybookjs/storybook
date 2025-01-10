<script>
  import { onMount } from 'svelte';
  export let svelteVersion;
  export let decorator;
  export let decoratorProps = {};
  export let component;
  export let props = {};
  export let on;

  let instance;
  let decoratorInstance;

  function getInstance() {
    // instance can be undefined if a decorator doesn't have <slot/>
    return instance || decoratorInstance;
  }

  if (on && svelteVersion < 5) {
    // Attach svelte event listeners.
    Object.keys(on).forEach((eventName) => {
      onMount(() => getInstance().$on(eventName, on[eventName]));
    });
  }
</script>
{#if decorator}
  <svelte:component this={decorator} {...decoratorProps} bind:this={decoratorInstance}>
    <svelte:component this={component} {...props} bind:this={instance}/>
  </svelte:component>
{:else}
  <svelte:component this={component} {...props} bind:this={instance}/>
{/if}
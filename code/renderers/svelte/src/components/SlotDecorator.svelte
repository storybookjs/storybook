<script>
  import { onMount } from 'svelte';
  import { VERSION } from 'svelte/compiler';

  export let decorator = undefined;
  export let Component;
  export let props = {};
  export let on = undefined;

  let instance;
  let decoratorInstance;

  const svelteVersion = VERSION[0];

  if (on && svelteVersion < 5) {
    // Attach Svelte event listeners in Svelte v4
    // In Svelte v5 this is not possible anymore as instances are no longer classes with $on() properties, so it will be a no-op
    onMount(() => {
      Object.entries(on).forEach(([eventName, eventCallback]) => {
        // instance can be undefined if a decorator doesn't have <slot/>
        const inst = instance ?? decoratorInstance;
        inst?.$on?.(eventName, eventCallback)
      });
    });
  }
</script>

{#if decorator}
  <svelte:component this={decorator.Component} {...decorator.props} bind:this={decoratorInstance}>
    <svelte:component this={Component} {...props} bind:this={instance} />
  </svelte:component>
{:else}
  <svelte:component this={Component} {...props} bind:this={instance} />
{/if}

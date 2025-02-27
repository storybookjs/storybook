<script>
  export let decorator;
  export let decoratorProps = {};
  export let component;
  export let props = {};
  let instance;
  let decoratorInstance;
</script>
{#if decorator}
  <svelte:component this={decorator} {...decoratorProps} bind:this={decoratorInstance}>
    <svelte:component this={component} {...props} bind:this={instance}/>
  </svelte:component>
{:else}
  <svelte:component this={component} {...props} bind:this={instance}/>
{/if}
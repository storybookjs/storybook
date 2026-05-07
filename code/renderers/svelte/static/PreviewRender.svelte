<script>
  // Vite 8's Rolldown dep scanner can load this file through a virtual-module id.
  // Keep this as a package export so sibling .svelte resolution is not importer-path dependent.
  import DecoratorHandler from '@storybook/svelte/internal/DecoratorHandler.svelte';
  import { dedent } from 'ts-dedent';

  const { name, title, storyFn, showError } = $props();

  let {
    /** @type {import('svelte').SvelteComponent} */
    Component,
    props = {},
  } = $derived.by(() => {
    return storyFn();
  });

  $effect(() => {
    if (!Component) {
      showError({
        title: `Expecting a Svelte component from the story: "${name}" of "${title}".`,
        description: dedent`
        Did you forget to return the Svelte component configuration from the story?
        Use "() => ({ Component: YourComponent, props: {} })"
        when defining the story.
      `,
      });
    }
  });
</script>

<svelte:boundary>
  {#snippet pending()}
    <div id="sb-pending-async-component-notice">Pending async component...</div>
  {/snippet}
  <DecoratorHandler {Component} {props} />
</svelte:boundary>

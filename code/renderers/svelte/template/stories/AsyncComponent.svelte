<script>
  let shown = $state(false);
  let { onEffect } = $props();

  /*
  TODO: Replace this with the comment below once async components have been released in Svelte.
  https://github.com/sveltejs/svelte/discussions/15845
  await new Promise((resolve) => {
    setTimeout(() => {
      onEffect?.();
      shown = true;
      resolve();
    }, 100);
  });
  */
  $effect(() => {
    onEffect?.();
    shown = true;
  });
</script>

{#if shown}
  <div data-testid="after-effect">This element is shown after the component's effect runs</div>
{/if}

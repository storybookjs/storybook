<script lang="ts">
  let shown = $state(false);

  let { onEffect }: { onEffect?: () => void } = $props();

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      onEffect?.();
      shown = true;
      resolve();
    }, 100);
  });
</script>

{#if shown}
  <div data-testid="after-effect">This element is shown after the component's effect runs</div>
{/if}

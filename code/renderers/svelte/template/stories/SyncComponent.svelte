<script lang="ts">
  let shown = $state(false);

  let { onEffect }: { onEffect?: () => void } = $props();

  $effect(() => {
    onEffect?.();
    shown = true;
  });
</script>

{#if shown}
  <div data-testid="after-effect">This element is shown after the component's effect runs</div>
{/if}

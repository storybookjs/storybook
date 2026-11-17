<script lang="ts">
  interface Props {
    count: number;
    onIncrement: () => void;
  }

  let { count, onIncrement }: Props = $props();
</script>

<button type="button" onclick={onIncrement}>Increment</button>
<p data-testid="count">Count: {count}</p>

<script>
  let count = $state(0);
</script>

<div>
  <h1>Counter</h1>
  <h2 data-testid="count">You clicked {count} times</h2>
  <button type="button" onclick={() => count--}>Decrement</button>
  <button type="button" onclick={() => count++}>Increment</button>
</div>

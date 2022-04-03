<script>
  let count = 0;
</script>

<div>
  <h1>Counter</h1>
  <h2 data-testid="count">You clicked {count} times</h2>
  <button type="button" on:click={() => count--}>Decrement</button>
  <button type="button" on:click={() => count++}>Increment</button>
</div>

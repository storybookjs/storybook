<script>
  const { onSuccess } = $props();

  let value = $state('');
  let complete = $state(false);

  function handleClick(event) {
    value = event.target.value;
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSuccess(value);

    setTimeout(() => {
      complete = true;
    }, 500);

    setTimeout(() => {
      complete = false;
    }, 1500);
  }
</script>

<form id="interaction-test-form" onsubmit={handleSubmit}>
  <label>
    Enter Value
    <input type="text" data-testid="value" bind:value required onclick={handleClick} />
  </label>
  <button type="submit">Submit</button>
  {#if complete}<p>Completed!!</p>{/if}
</form>

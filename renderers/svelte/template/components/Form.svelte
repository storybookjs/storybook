<script>
  /**
   * Callback for when the form succeeds
   */
  export let onSuccess;

  let value = '';
  function handleClick(event) {
    value = event.target.value;
  }

  let complete = false;
  function handleSubmit() {
    onSuccess(value);

    setTimeout(() => {
      complete = true;
    }, 500);

    setTimeout(() => {
      complete = false;
    }, 1500);
  }
</script>

<form id="interaction-test-form" on:submit|preventDefault={handleSubmit}>
  <label>
    Enter Value
    <input type="text" data-testid="value" bind:value required on:click={handleClick} />
  </label>
  <button type="submit">Submit</button>
  {#if complete}<p>Completed!!</p>{/if}
</form>
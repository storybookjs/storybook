<script>
  import Button from './Button.svelte';

  const { args } = $props();
</script>

<div>
  <p data-testid="custom-render">I am a custom render function</p>
  <Button {...args} />
</div>
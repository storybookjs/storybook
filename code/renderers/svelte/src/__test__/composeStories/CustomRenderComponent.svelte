<script lang="ts">
  import Button from './Button.svelte';
  import type { ComponentProps } from 'svelte';

  let { buttonProps }: { buttonProps: ComponentProps<typeof Button> } = $props();
</script>

<div>
  <p data-testid="custom-render">I am a custom render function</p>
  <Button {...buttonProps} />
</div>

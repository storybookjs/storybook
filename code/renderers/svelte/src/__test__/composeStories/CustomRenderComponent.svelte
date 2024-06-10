<script lang="ts">
  import Button from './Button.svelte';
  import { ComponentProps } from 'svelte';

  export let buttonProps: ComponentProps<Button>;
</script>

<div>
  <p data-testid="custom-render">I am a custom render function</p>
  <Button {...buttonProps} />
</div>

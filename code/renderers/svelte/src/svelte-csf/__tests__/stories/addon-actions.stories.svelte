<script lang="ts" context="module">
  import { action } from '@storybook/addon-actions';
  import type { Meta } from '@storybook/svelte';

  import Button from './Button.svelte';

  export const meta = {
    title: 'Addon/Actions',
    component: Button,
  } satisfies Meta<Button>;
</script>

<script>
  import { Story } from '../src/index.js';
</script>

<Story name="Action on component method">
  <Button text="Custom text" onclick={action('I am logging in the actions tab')} />
</Story>

<script module lang="ts">
  import { expect } from 'storybook/test';

  import preview from './preview.ts';
  import Button from '../Button.svelte';

  export const meta = preview.meta({ component: Button, args: { disabled: false } });
  const { Story } = meta;
</script>

<Story
  name="Primary"
  args={{ label: 'Primary' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveTextContent('Primary');
  }}
/>

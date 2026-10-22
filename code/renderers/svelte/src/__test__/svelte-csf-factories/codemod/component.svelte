<script module lang="ts">
  import preview from '../preview';
  import { fn } from 'storybook/test';

  import Button from '../../Button.svelte';

  const { Story } = preview.meta({
    component: Button,
    args: { clicked: fn() },
  });
</script>

<Story name="Primary" args={{ label: 'Button', disabled: false }} />

<Story name="Template" args={{ label: 'Button', disabled: true }}>
  {#snippet template(args)}
    <Button {...args} />
  {/snippet}
</Story>

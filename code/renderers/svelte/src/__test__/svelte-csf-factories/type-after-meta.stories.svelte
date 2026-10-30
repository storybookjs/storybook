<script module lang="ts">
  import { expect } from 'storybook/test';

  import preview from './preview.ts';
  import Button from '../Button.svelte';

  // `icon` isn't a prop of the button: the template renders it as the label.
  const { Story } = preview
    .meta({ component: Button, args: { disabled: false } })
    .type<{ args: { icon: string } }>();
</script>

<Story
  name="Icon"
  args={{ label: 'Icon', icon: '★' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveTextContent('★');
  }}
>
  {#snippet template({ icon, ...args })}
    <Button {...args} label={icon} />
  {/snippet}
</Story>

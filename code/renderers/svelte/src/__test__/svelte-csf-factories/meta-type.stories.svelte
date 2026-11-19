<script module lang="ts">
  import { expect } from 'storybook/test';

  import preview from './preview.ts';
  import Button from '../Button.svelte';

  const meta = preview.meta({ component: Button, args: { disabled: false } });
  const { Story } = meta;
  // `icon` isn't a prop of the button: the template renders it as the label.
  const { Story: IconStory } = meta.type<{ args: { icon: string } }>();
</script>

<Story
  name="Primary"
  args={{ label: 'Primary' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveTextContent('Primary');
  }}
/>

<IconStory
  name="Icon"
  args={{ label: 'Icon', icon: '★' }}
  play={async ({ args, canvas }) => {
    await expect(args.icon).toBe('★');
    await expect(canvas.getByRole('button')).toHaveTextContent('★');
  }}
>
  {#snippet template({ icon, ...args })}
    <Button {...args} label={icon} />
  {/snippet}
</IconStory>

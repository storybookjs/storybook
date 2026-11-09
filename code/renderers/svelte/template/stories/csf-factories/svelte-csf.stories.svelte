<script module lang="ts">
  import preview from '#.storybook/preview';
  import { expect } from 'storybook/test';

  // @ts-expect-error fix globalThis.__TEMPLATE_COMPONENTS__ type not existing later
  const Button = globalThis.__TEMPLATE_COMPONENTS__.Button;

  const meta = preview.meta({ component: Button, args: { label: 'Hello world!' } });
  const { Story } = meta;
  const { Story: IconStory } = meta.type<{ args: { icon: string } }>();
</script>

<Story
  name="Primary"
  args={{ primary: true }}
  play={async ({ args, canvas }) => {
    await expect(args).toMatchObject({ label: 'Hello world!', primary: true });
    await expect(canvas.getByRole('button')).toHaveTextContent('Hello world!');
  }}
/>

<IconStory
  name="Icon"
  args={{ icon: '★' }}
  play={async ({ args, canvas }) => {
    await expect(args).toMatchObject({ label: 'Hello world!', icon: '★' });
    await expect(canvas.getByRole('button')).toHaveTextContent('★ Hello world!');
  }}
>
  {#snippet template({ icon, label, ...args })}
    <Button {...args} label="{icon} {label}" />
  {/snippet}
</IconStory>

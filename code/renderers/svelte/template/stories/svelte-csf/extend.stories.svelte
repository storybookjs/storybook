<script module lang="ts">
  import preview from '#.storybook/preview';
  import { expect } from 'storybook/test';

  import Button from './button.svelte';

  /**
   * A story extends another story of the file with `extend`, like `story.extend()`. It merges the
   * args and tags of that story, and it renders its children or `template` and runs its play
   * function, unless it sets its own.
   */
  const { Story } = preview.meta({ component: Button, tags: ['autodocs'] });
</script>

<!-- A story can extend a story that comes later in the file -->
<Story
  extend="Primary"
  name="Primary Small"
  args={{ size: 'small' }}
  play={async ({ args, canvas, tags }) => {
    await expect(args).toMatchObject({ primary: true, size: 'small' });
    await expect(tags).toContain('primary');
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('Click me');
    await expect(button).toHaveClass('primary', 'small');
  }}
/>

<Story
  name="Primary"
  args={{ primary: true }}
  tags={['primary']}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveTextContent('Click me');
  }}
>
  Click me
</Story>

<!-- Runs the play function of "Primary" -->
<Story extend="Primary" name="Primary Large" args={{ size: 'large' }} />

<Story
  extend="Primary Large"
  name="Primary Large Starred"
  args={{ disabled: true }}
  tags={['starred']}
  play={async ({ args, canvas, tags }) => {
    await expect(args).toMatchObject({ primary: true, size: 'large', disabled: true });
    await expect(tags).toEqual(expect.arrayContaining(['primary', 'starred']));
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('★ Starred');
    await expect(button).toBeDisabled();
  }}
>
  {#snippet template({ children: _, ...args })}
    <Button {...args}>★ Starred</Button>
  {/snippet}
</Story>

<!-- Renders the template of "Primary Large Starred" -->
<Story
  extend="Primary Large Starred"
  name="Primary Large Starred Enabled"
  args={{ disabled: false }}
  play={async ({ canvas }) => {
    const button = canvas.getByRole('button');
    await expect(button).toHaveTextContent('★ Starred');
    await expect(button).toBeEnabled();
  }}
/>

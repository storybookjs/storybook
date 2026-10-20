<script module>
  import { fn, expect, userEvent } from 'storybook/test';
  import { defineMeta } from '@storybook/svelte';

  const { Story } = defineMeta({
    args: {
      onclick: fn().mockName('onclick'),
    },
    parameters: {
      chromatic: { disableSnapshot: true },
      controls: { disable: true },
    },
  });
</script>

<Story
  name="Default"
  play={async (context) => {
    const { args, canvas } = context;
    const button = await canvas.findByRole('button');

    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(args.onclick).toHaveBeenCalled();
  }}
>
  {#snippet template(args)}
    <button {...args}>
      Click me to see an a log in the <strong>Actions</strong> tab
    </button>
  {/snippet}
</Story>

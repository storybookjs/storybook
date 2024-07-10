<script context="module">
  import { fn } from '@storybook/test';
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, userEvent, within } from '@storybook/test';

  const { Story } = defineMeta({
    title: 'Addon/Actions',
    args: {
      onclick: fn().mockName('onclick'),
    },
    parameters: {
      controls: { disable: true },
    },
  });
</script>

<Story
  name="Default"
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');

    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(args.onclick).toHaveBeenCalled();
  }}
>
  {#snippet children(args)}
    <button {...args}>
      Click me to see an a log in the <strong>Actions</strong> tab
    </button>
  {/snippet}
</Story>

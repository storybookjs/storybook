<script context="module">
  import { defineMeta as d } from '@storybook/addon-svelte-csf';

  const { Story: S, meta: m } = d({
    title: 'Test overrides',
    args: {
      message: 'Hello from Storybook for Svelte using CSF!',
    },
    argTypes: {
      text: { control: 'text' },
    },
  });
</script>

<S name="Default">
  {#snippet children(args)}
    <p>
      You can import <code style="font-weight: bolder;">Story</code> component as whatever name you want
      to - we've got it covered.
    </p>
    <p>{args.message}</p>
  {/snippet}
</S>

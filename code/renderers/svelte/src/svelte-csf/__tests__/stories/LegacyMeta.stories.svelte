<script context="module">
  import { Meta, Story, Template } from '@storybook/addon-svelte-csf';
  import { expect, within } from 'storybook/test';

  import LegacyMeta from './LegacyMeta.svelte';

  let count = 0;

  function handleClick() {
    count += 1;
  }
</script>

<Meta
  title="Legacy Meta"
  component={LegacyMeta}
  play={async (context) => {
    const { canvasElement, step } = context;
    const canvas = within(canvasElement);
    await step("The container renders it's contents", async () => {
      expect(await canvas.findByRole('button')).toBeInTheDocument();
    });
  }}
/>

<Template let:args>
  <LegacyMeta {...args} on:click={handleClick} on:click>
    You clicked: {count}
  </LegacyMeta>
</Template>

<Story name="Default" />

<Story name="Rounded" args={{ rounded: true }} />

<Story name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story name="No Args">
  <LegacyMeta>Label</LegacyMeta>
</Story>

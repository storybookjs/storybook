<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Controls from './Controls.svelte';

  /**
   * This is an visual example for using/testing the args table
   */
  const { Story } = defineMeta({
    title: 'Addon/Controls',
    component: Controls,
    tags: ['autodocs'],
    args: {
      sampleRequiredBoolean: true,
      sampleRequiredString: 'I agree',
      sampleRequiredNumber: 10,
      sampleRequiredArray: ['I', 'like', 'Svelte', 'and', 'Storybook'],
      sampleRequiredEnum: 'storybook',
      sampleRequiredObject: { tool: 'storybook', rating: 10 },
    },
  });
</script>

<Story
  name="Default"
  parameters={{
    actions: { disable: true },
    interactions: { disable: true },
  }}
/>

<Story
  name="Playground"
  args={{
    sampleRequiredBoolean: false,
    sampleRequiredString: 'Different',
    sampleRequiredNumber: 10,
    sampleRequiredArray: ['I', 'like', 'Storybook', 'and', 'Svelte'],
    sampleRequiredEnum: 'storybook',
    sampleRequiredObject: { tool: 'storybook', rating: 11 },
  }}
>
  {#snippet children(args)}
    <Controls {...args} />
  {/snippet}
</Story>

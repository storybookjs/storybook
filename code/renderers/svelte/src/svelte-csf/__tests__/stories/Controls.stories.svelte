<script context="module">
  import { defineMeta } from '../src/index';

  import Controls from './Controls.svelte';

  /**
   * This is an visual example for using/testing the args table
   */
  const { Story } = defineMeta({
    title: 'Addon/Controls',
    component: Controls,
    parameters: {
      actions: { disable: true },
      interactions: { disable: true },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="Playground"
  args={{
    sampleRequiredBoolean: true,
    sampleRequiredString: 'I agree',
    sampleRequiredNumber: 10,
    sampleRequiredArray: ['I', 'like', 'Svelte', 'and', 'Storybook'],
    sampleRequiredEnum: 'storybook',
    sampleRequiredObject: { tool: 'storybook', rating: 10 },
  }}
>
  {#snippet children(args)}
    <Controls {...args} />
  {/snippet}
</Story>

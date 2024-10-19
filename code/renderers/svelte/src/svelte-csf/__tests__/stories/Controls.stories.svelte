<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Controls from './Controls.svelte';

  /**
   * Test the **Args table** below...
   *
   * ... or the **Controls tab** in the `Playground` story.
   */
  const { Story } = defineMeta({
    title: 'Addons/Controls',
    component: Controls,
    tags: ['autodocs', '!dev'],
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
  name="Playground"
  args={{
    sampleRequiredBoolean: false,
    sampleRequiredString: 'Different',
    sampleRequiredNumber: 10,
    sampleRequiredArray: ['I', 'like', 'Storybook', 'and', 'Svelte'],
    sampleRequiredEnum: 'storybook',
    sampleRequiredObject: { tool: 'storybook', rating: 11 },
  }}
  tags={['!dev']}
/>

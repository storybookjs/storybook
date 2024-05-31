<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Text from './Text.svelte';
  import BackgroundDecorator from './BackgroundDecorator.svelte';

  /** Demonstration on how to use decorators & visual test */
  const { Story } = defineMeta({
    component: Text,
    tags: ['autodocs'],
    decorators: [() => ({ Component: BackgroundDecorator, props: { color: 'pink' } })],
  });
</script>

<Story name="Meta decorator" args={{ text: 'From defineMeta decorators entry' }} />

<Story
  name="Story decorator"
  args={{ text: 'from Story decorators argument' }}
  decorators={[() => ({ Component: BackgroundDecorator, props: { color: 'lightblue' } })]}
/>

<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Text from './Text.svelte';
  import BackgroundDecorator from './BackgroundDecorator.svelte';

  /** Demonstration on how to use decorators & visual test */
  const { Story } = defineMeta({
    component: Text,
    tags: ['autodocs'],
    decorators: [
      // This one is the parent which wraps all of the decorators defined in this stories file
      () => ({
        Component: BackgroundDecorator,
        props: { color: 'pink', width: '100%' },
      }),
    ],
  });
</script>

<Story name="Meta decorator" args={{ text: 'From defineMeta decorators entry' }} />

<Story
  name="Story decorator"
  args={{ text: 'This one will nest another decorator inside the defineMeta' }}
  decorators={[
    () => ({
      Component: BackgroundDecorator,
      props: { color: 'lightblue', width: '75%' },
    }),
  ]}
/>

<Story
  name="Deeply nested"
  args={{ text: 'And more decorators which will deeply nest' }}
  decorators={[
    () => ({ Component: BackgroundDecorator, props: { color: 'red', width: 'fit-content' } }), // First one is the last children
    () => ({ Component: BackgroundDecorator, props: { color: 'green', width: '60ch' } }),
    () => ({ Component: BackgroundDecorator, props: { color: 'blue', width: '90%' } }), // This one the parent which wraps all of the above
  ]}
/>

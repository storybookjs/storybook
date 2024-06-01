<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Test from './Test.svelte';

  /**
   * Test for the 'source' prop
   */
  const { Story } = defineMeta({
    title: 'Source prop',
    component: Test,
    argTypes: {
      csf: { table: { disable: true } },
      system: { table: { disable: true } },
    },
    tags: ['autodocs', '!dev'],
  });
</script>

<Story
  name="Default"
  args={{ csf: 'svelte' }}
  source={'<button onclick={() => sheldonAppears()}>Bazinga!</button>'}
/>

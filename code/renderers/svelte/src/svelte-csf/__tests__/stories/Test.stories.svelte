<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Test from './Test.svelte';

  /**
   * Test for Svelte CSF
   */
  const { Story } = defineMeta({
    title: 'Test/Svelte CSF',
    component: Test,
    argTypes: {
      csf: { table: { disable: true } },
      system: { table: { disable: true } },
    },
    tags: ['autodocs', '!dev'],
  });
</script>

<Story name="Default" args={{ csf: 'svelte' }}>
  {#snippet children(args)}
    <Test {...args} />
  {/snippet}
</Story>

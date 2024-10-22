<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  /**
   * Testing tags parsing in the addon's indexer.
   * - In the sidebar, only the _"With Dev"_ story should be visible.
   * - In docs, only the _"With Autodocs"_ story should be visible.
   */
  const { Story } = defineMeta({
    title: 'Tags',
    parameters: {
      controls: { disable: true },
    },
    tags: ['!dev', '!autodocs', '!test'],
  });
</script>

<Story name="With Autodocs" tags={['autodocs']}>With autodocs</Story>

<Story name="With Dev" tags={['dev']}>With dev</Story>

<Story name="With Test" tags={['test']}>With test</Story>

<Story name="No Tags">No tags</Story>

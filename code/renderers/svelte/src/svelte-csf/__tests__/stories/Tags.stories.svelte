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
    tags: ['custom-tag'],
  });
</script>

<Story name="With Autodocs" tags={['autodocs']}>With autodocs</Story>

<Story name="Without Dev" tags={['!dev', 'autodocs']}>Without dev</Story>

<Story
  name="Without Test"
  tags={['!test']}
  play={() => {
    throw new Error('This error is on purpose');
  }}
>
  This story fails interaction testing, but should not run in Vitest because it has the
  <code>"!test"</code> tag.
</Story>

<Story name="No story-level tags">No story-level tags</Story>

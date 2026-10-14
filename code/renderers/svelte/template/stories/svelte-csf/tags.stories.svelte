<script module>
  import { defineMeta } from '@storybook/svelte';

  /**
   * The indexer reads meta and story tags:
   * - The sidebar hides "Without Dev".
   * - Docs show only the stories with the `autodocs` tag.
   */
  const { Story } = defineMeta({
    parameters: {
      chromatic: { disableSnapshot: true },
      controls: { disable: true },
    },
    tags: ['custom-tag'],
  });
</script>

<Story name="With Autodocs" tags={['autodocs']}>With autodocs</Story>

<Story name="Without Dev" tags={['!dev', 'autodocs']}>Without dev</Story>

<Story
  name="Without Test"
  tags={['!test', '!vitest']}
  play={() => {
    throw new Error('This error is on purpose');
  }}
>
  This story fails interaction testing, but should not run in Vitest because it has the
  <code>"!test"</code> tag.
</Story>

<Story name="No story-level tags">No story-level tags</Story>

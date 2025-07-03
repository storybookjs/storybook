<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  /**
   * this is a meta comment
   */
  const { Story } = defineMeta({
    title: 'StoryContext',
    parameters: {
      actions: { disable: true },
      controls: { disable: true },
      interactions: { disable: true },
    },
  });

  // removes circular references
  function replacer(key, value) {
    if (['context', 'currentContext'].includes(key)) {
      return null;
    }
    return value;
  }
</script>

<!-- This is a story comment -->
<Story name="Default">
  {#snippet template(_args, context)}
    <pre>
      <code>
{JSON.stringify(context, replacer, 2)}
      </code>
    </pre>
  {/snippet}
</Story>

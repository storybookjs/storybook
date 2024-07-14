<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

<Story name="Default">
  {#snippet children(_args, context)}
    <pre>
      <code>
{JSON.stringify(context, replacer, 2)}
      </code>
    </pre>
  {/snippet}
</Story>

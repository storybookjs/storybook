<script context="module">
  export const meta = {
    title: 'StoryContext',
    parameters: {
      controls: { disable: true },
      interactions: { disable: true },
    },
  };
</script>

<script>
  import { defineComponent } from '../src/index';

  const { Story } = defineComponent(meta);
</script>

<Story name="Example">
  {#snippet children({ context })}
    {#each Object.entries(context) as [key, value]}
      {#if typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === "function"}
        <code><strong>StoryContext.{key}:</strong> {value.toString()}</code><br>
      {:else if typeof value === 'object'}
        {#each Object.keys(value) as nestedKey}
          <code><strong>StoryContext.{key}.${nestedKey}</strong></code><br>
        {/each}
      {/if}
    {/each}
  {/snippet}
</Story>

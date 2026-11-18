<script module lang="ts">
  import { defineMeta, type StoryContext } from '@storybook/svelte';
  import { expect } from 'storybook/test';

  import RequiredSnippet from './required-snippet.svelte';

  /**
   * The component requires a `children` snippet. Each story passes it in a different way.
   */
  const { Story } = defineMeta({
    component: RequiredSnippet,
    tags: ['autodocs'],
    parameters: {
      chromatic: { disableSnapshot: true },
    },
  });

  async function play({ canvas }: Pick<StoryContext, 'canvas'>) {
    await expect(canvas.getByText('This works')).toBeInTheDocument();
  }
</script>

{#snippet children()}
  <p>This works</p>
{/snippet}

<Story name="Snippet in args" args={{ children }} {play} />

<Story name="Snippet in the story" {play}>
  {#snippet children()}
    <p>This works</p>
  {/snippet}
</Story>

<Story name="Story children" {play}>
  <p>This works</p>
</Story>

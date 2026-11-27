<script module>
  import { defineMeta } from '@storybook/svelte';
  import { expect } from 'storybook/test';

  /**
   * A `template` snippet gets the story context as its second argument.
   */
  const { Story } = defineMeta({
    parameters: {
      chromatic: { disableSnapshot: true },
      actions: { disable: true },
      controls: { disable: true },
    },
  });
</script>

<Story
  name="Default"
  play={async ({ canvas, id, name }) => {
    await expect(canvas.getByTestId('name')).toHaveTextContent(name);
    await expect(canvas.getByTestId('id')).toHaveTextContent(id);
  }}
>
  {#snippet template(_args, context)}
    <p data-testid="name">{context.name}</p>
    <p data-testid="id">{context.id}</p>
  {/snippet}
</Story>

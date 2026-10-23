<script module lang="ts">
  import { expect, userEvent } from 'storybook/test';
  import { tick } from 'svelte';

  import preview from './preview.ts';
  import Interactions from '../../../template/stories/svelte-csf/interactions.svelte';

  const { Story } = preview.meta({ component: Interactions });
</script>

<script lang="ts">
  let i = $state(0);
</script>

<Story
  name="Default"
  play={async ({ canvas }) => {
    const count = await canvas.findByTestId('count');

    await userEvent.click(await canvas.findByText('Increment'));
    await expect(count).toHaveTextContent('You clicked 1 times');
  }}
/>

<Story
  name="Capturing scope"
  asChild
  play={async ({ canvas }) => {
    const p = canvas.getByTestId('count');
    await expect(p).toHaveTextContent('0');

    i++;
    await tick();
    await expect(p).toHaveTextContent('1');
  }}
>
  <p data-testid="count">{i}</p>
</Story>

<Story
  name="Story context"
  play={async ({ canvas, name }) => {
    await expect(canvas.getByTestId('name')).toHaveTextContent(name);
  }}
>
  {#snippet template(_args, context)}
    <p data-testid="name">{context.name}</p>
  {/snippet}
</Story>

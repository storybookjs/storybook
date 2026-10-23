<script module>
  import { defineMeta } from '@storybook/svelte';
  import { expect, userEvent } from 'storybook/test';
  import { tick } from 'svelte';

  import Interactions from './interactions.svelte';

  const { Story } = defineMeta({
    component: Interactions,
    parameters: {
      chromatic: { disableSnapshot: true },
      actions: { disable: true },
      controls: { disable: true },
    },
  });

  async function play({ canvas }) {
    const count = await canvas.findByTestId('count');

    await userEvent.click(await canvas.findByText('Increment'));
    expect(count.textContent).toEqual('You clicked 1 times');

    await userEvent.click(await canvas.findByText('Decrement'));
    expect(count.textContent).toEqual('You clicked 0 times');
  }
</script>

<script>
  let i = $state(0);
</script>

<Story name="Default" {play}>
  <Interactions />
</Story>

<Story
  name="Capturing scope"
  play={async (context) => {
    const { canvas } = context;
    const p = canvas.getByTestId('count');

    expect(p.textContent).toEqual('0');

    i++;
    await tick();
    expect(p.textContent).toEqual('1');

    i--;
    await tick();
    expect(p.textContent).toEqual('0');
  }}
  asChild
>
  <p data-testid="count">{i}</p>
</Story>

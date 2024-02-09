<script>
  import { Meta, Story } from '../src/index';
  import { expect } from '@storybook/test';
  import { userEvent, within } from '@storybook/test';
  import { tick } from 'svelte';
  import Counter from './Counter.svelte';

  async function play({ canvasElement }) {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Increment'));

    const count = await canvas.findByTestId('count');
    expect(count.textContent).toEqual('You clicked 1 times');
  }

  let i = 0;
</script>

<Meta title="Interactions" component={Counter} />

<Story name="Play" {play}>
  <Counter />
</Story>

<Story
  name="Play (capturing scope)"
  play={async (storyContext) => {

    const { canvasElement } = storyContext;
    const canvas = within(canvasElement);
    const p = canvas.getByTestId('count');
    expect(p.textContent).toEqual('0');
    i++;
    await tick();
    expect(p.textContent).toEqual('1');
  }}
>
  <p data-testid="count">{i}</p>
</Story>

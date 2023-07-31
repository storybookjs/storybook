<script>
  import { Meta, Story } from '../src/index';
  import { expect } from '@storybook/jest';
  import { userEvent, within } from '@storybook/testing-library';

  import Counter from './Counter.svelte';

  async function play({ canvasElement }) {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Increment'));

    const count = await canvas.findByTestId('count');
    expect(count.textContent).toEqual('You clicked 1 times');
  }
</script>

<Meta title="Interactions" component={Counter} />

<Story name="Play" {play}>
  <Counter />
</Story>

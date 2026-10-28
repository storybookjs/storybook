<script module lang="ts">
  import { expect } from 'storybook/test';
  import { tick } from 'svelte';

  import preview from './preview.ts';
  import Interactions from '../../../template/stories/svelte-csf/interactions.svelte';

  const { Story } = preview.meta({ component: Interactions });
</script>

<script lang="ts">
  let i = $state(0);
</script>

<Story
  name="Static"
  asChild
  play={async ({ canvas }) => {
    const p = canvas.getByTestId('count');
    await expect(p).toHaveTextContent('0');

    i++;
    await tick();
    await expect(p).toHaveTextContent('1');
    i--;
  }}
>
  <p data-testid="count">{i}</p>
</Story>

<Story extend="Static" name="Static Extended" />

<Story
  extend="Static"
  name="Static Own Play"
  play={async ({ canvas, name }) => {
    await expect(canvas.getByTestId('count')).toHaveTextContent('0');
    await expect(name).toBe('Static Own Play');
  }}
/>

<Story
  extend="Static"
  name="Static Own Children"
  play={async ({ canvas }) => {
    await expect(canvas.getByTestId('own')).toBeInTheDocument();
    await expect(canvas.queryByText('Increment')).not.toBeInTheDocument();
  }}
>
  <p data-testid="own">Own children</p>
</Story>

<Story
  name="Children"
  play={async ({ canvas }) => {
    await expect(await canvas.findByText('Increment')).toBeInTheDocument();
  }}
>
  <p data-testid="children">Children</p>
</Story>

<Story
  extend="Children"
  name="Children As Child"
  asChild
  play={async ({ canvas }) => {
    await expect(canvas.getByTestId('children')).toBeInTheDocument();
    await expect(canvas.queryByText('Increment')).not.toBeInTheDocument();
  }}
/>

<Story name="Component" />

<Story
  extend="Component"
  name="Component Extended"
  play={async ({ canvas }) => {
    await expect(await canvas.findByText('Increment')).toBeInTheDocument();
  }}
/>

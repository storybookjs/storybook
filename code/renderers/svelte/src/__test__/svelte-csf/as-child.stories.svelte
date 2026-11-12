<script module lang="ts">
  import { expect, within } from 'storybook/test';
  import { tick } from 'svelte';

  import { defineMeta } from '@storybook/svelte';
  import Counter from '../Counter.svelte';

  const { Story } = defineMeta({ component: Counter });
</script>

<script lang="ts">
  let isStatic = $state(true);
</script>

<Story
  name="Dynamic"
  asChild={isStatic}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('static')).toBeInTheDocument();

    isStatic = false;
    await tick();
    await expect(await canvas.findByRole('button')).toBeInTheDocument();
    await expect(canvas.queryByTestId('static')).not.toBeInTheDocument();
    isStatic = true;
  }}
>
  <p data-testid="static">Static</p>
</Story>

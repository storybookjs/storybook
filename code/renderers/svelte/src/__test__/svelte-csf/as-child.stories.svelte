<script module lang="ts">
  import { expect, within } from 'storybook/test';
  import { tick } from 'svelte';

  import { defineMeta } from '@storybook/svelte';
  import Interactions from '../../../template/stories/svelte-csf/interactions.svelte';

  const { Story } = defineMeta({ component: Interactions });
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
    await expect(await canvas.findByText('Increment')).toBeInTheDocument();
    isStatic = true;
  }}
>
  <p data-testid="static">Static</p>
</Story>

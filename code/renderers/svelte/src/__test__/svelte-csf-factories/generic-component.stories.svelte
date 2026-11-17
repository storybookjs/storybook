<script module lang="ts">
  import { expect } from 'storybook/test';

  import preview from './preview.ts';
  import List from '../List.svelte';

  const { Story } = preview.meta({ component: List<{ id: number; name: string }> });
</script>

<Story
  name="Items"
  args={{ items: [{ id: 1, name: 'Ada' }], getLabel: (item) => item.name }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('listitem')).toHaveTextContent('Ada');
  }}
/>

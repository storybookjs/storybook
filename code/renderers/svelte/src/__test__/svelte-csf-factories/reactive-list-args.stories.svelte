<script module lang="ts">
  import { tick } from 'svelte';

  import preview from './preview.ts';
  import List from '../List.svelte';

  const { Story } = preview.meta({ component: List });

  const items = $state(['a']);

  function getLabel(item: unknown) {
    return String(item);
  }

  async function pushItem() {
    items.push('b');
    await tick();
  }
</script>

<Story name="In Place" args={{ items, getLabel }} play={pushItem} />

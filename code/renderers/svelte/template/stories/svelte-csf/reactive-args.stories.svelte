<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';

  import Counter from './counter.svelte';

  /**
   * State passed to `args` stays reactive: when the state changes, Storybook updates the arg and
   * the story renders it. The Controls panel shows the new value, and can still change it.
   */
  const { Story } = defineMeta({ component: Counter });

  let count = $state(0);

  function onIncrement() {
    count += 1;
  }
</script>

<Story name="Module State" args={{ count, onIncrement }} />

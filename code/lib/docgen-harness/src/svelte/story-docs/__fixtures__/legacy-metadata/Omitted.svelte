<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  import type { WithoutChildren, WithRef } from './ref-types';

  let { ref = $bindable(null), ...rest }: WithoutChildren<WithRef<HTMLTextareaAttributes>> =
    $props();
</script>

<textarea bind:this={ref} {...rest}></textarea>

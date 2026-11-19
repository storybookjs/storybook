<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends HTMLInputAttributes {
    /** Current value. */
    value?: string;
    /** Checked state. */
    checked?: boolean;
  }

  let { value = $bindable(''), checked = $bindable(false), ...rest }: Props = $props();
</script>

<label>
  <input type="checkbox" value={value} bind:checked {...rest} />
  <span>{value}</span>
</label>

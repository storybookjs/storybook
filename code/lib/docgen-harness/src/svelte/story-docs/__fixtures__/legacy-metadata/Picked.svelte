<script lang="ts">
  import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLAttributes<HTMLDivElement> &
    Pick<HTMLButtonAttributes, 'disabled' | 'type'> & { label: string };

  let { label, disabled, type, ...rest }: Props = $props();
</script>

<div {...rest}><button {disabled} {type}>{label}</button></div>

<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { FileData } from './types.ts';

  let {
    elem_id,
    elem_classes = [],
    visible = true,
    variant = 'secondary',
    value = null,
    scale = null,
    min_width,
    icon,
    onclick = () => {},
    children,
  }: {
    /** Element id. */
    elem_id?: string | null;
    /** Element class names. */
    elem_classes?: string[] | null;
    /** Visibility state. */
    visible?: boolean | 'hidden';
    /** Button variant. */
    variant?: 'primary' | 'secondary' | 'stop';
    /** Button label. */
    value?: string | null;
    /** Flex scale. */
    scale?: number | null;
    /** Minimum width. */
    min_width?: number | null | undefined;
    /** Icon file data. */
    icon?: FileData | null;
    /** Click callback. */
    onclick?: () => void;
    /** Button content. */
    children?: Snippet;
  } = $props();
</script>

{#if visible !== false}
  <button
    id={elem_id ?? undefined}
    class={elem_classes?.join(' ') ?? undefined}
    data-visible={visible}
    data-variant={variant}
    data-scale={scale}
    data-icon={icon?.path}
    style:min-width={min_width === null || min_width === undefined ? undefined : `${min_width}px`}
    onclick={onclick}
  >
    {value}
    {@render children?.()}
  </button>
{/if}

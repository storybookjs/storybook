<script lang="ts">
  import type { SvelteHTMLElements } from 'svelte/elements';

  interface $$Props
    extends Pick<SvelteHTMLElements['button'], 'id' | 'class' | 'disabled' | 'type'> {
    /** Button kind. */
    kind?: 'filled' | 'outline';
    /** Button size. */
    size?: 'small' | 'large';
    /** Click callback. */
    onClick?: (e: MouseEvent) => void;
    /** Data attribute passthrough. */
    [key: `data-${string}`]: string | number | boolean | undefined;
  }

  /** Button kind. */
  export let kind: $$Props['kind'] = 'filled';
  /** Button size. */
  export let size: $$Props['size'] = 'small';
  /** Click callback. */
  export let onClick: $$Props['onClick'] = undefined;
</script>

<button {...$$restProps} data-kind={kind} data-size={size} on:click={onClick}>
  <slot name="icon-before" />
  <slot />
</button>

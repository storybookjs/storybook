<script module lang="ts">
  export type Size = 16 | 24 | 32 | 48;
</script>

<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  interface Props {
    /**
     * Display name.
     */
    name: string;
    /** Avatar size. */
    size?: Size;
    /** Linked profile URL. */
    href?: string;
    /** Extra class value. */
    class?: ClassValue;
    /** Override display letter. */
    letter?: string;
  }

  let { name, size = 32, href, class: className, letter }: Props = $props();
</script>

<svelte:element this={href ? 'a' : 'span'} href={href} class={className} data-size={size}>
  {letter ?? name[0]}
</svelte:element>

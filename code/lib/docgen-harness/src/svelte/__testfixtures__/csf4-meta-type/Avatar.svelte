<script lang="ts">
  interface Props {
    /** Name shown as the image text alternative. */
    name: string;
    /** Image URL. */
    src?: string;
    /** Size in pixels. */
    size?: number;
  }

  let { name, src, size = 32 }: Props = $props();
</script>

<!--
@component
Avatar with a name, an optional image and a size.
-->

{#if src}
  <img {src} alt={name} width={size} height={size} />
{:else}
  <span aria-label={name} style:width="{size}px">{name.slice(0, 1)}</span>
{/if}

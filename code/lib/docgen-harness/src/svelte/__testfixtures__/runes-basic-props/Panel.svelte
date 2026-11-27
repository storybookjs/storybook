<script lang="ts">
  interface Props {
    /** Visible label text. */
    label: string;
    /** Numeric count. */
    count?: number;
    /** Primary visual state. */
    primary?: boolean;
    /** Optional title text. */
    title?: string;
  }

  let { label, count = 0, primary = false, title }: Props = $props();
</script>

<!--
@component
Panel with string, number and boolean props.

@summary Basic props fixture.
-->

<section data-primary={primary}>
  {#if title}
    <h2>{title}</h2>
  {/if}
  <span>{label}</span>
  <output>{count}</output>
</section>

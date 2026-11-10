<script lang="ts">
  interface Props {
    /** Visible label text. */
    label: string;
    /** Colour tone. */
    tone?: 'neutral' | 'success' | 'danger';
    /** Shows a remove button. */
    removable?: boolean;
  }

  let { label, tone = 'neutral', removable = false }: Props = $props();
</script>

<!--
@component
Tag with a label, a tone and an optional remove button.
-->

<span data-tone={tone}>
  {label}
  {#if removable}
    <button type="button" aria-label="Remove">×</button>
  {/if}
</span>

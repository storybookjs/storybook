<script lang="ts">
  interface Props {
    /** Markup shown as is. */
    html: string;
    /** Number of lines. */
    lines: number;
    /** Index of the selected line. */
    selectedLine?: number;
    /** Accessible name of the viewer. */
    heading?: string;
  }

  let { html, lines, selectedLine, heading }: Props = $props();
</script>

<section aria-label={heading}>
  {@html html}
  <span>{selectedLine ?? 0} / {lines}</span>
</section>

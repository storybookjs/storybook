<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Alert heading. */
    title: string;
    /** Severity level. */
    level?: 'info' | 'warning' | 'error';
    /** Shows a close button. */
    dismissible?: boolean;
    /** Alert body. */
    children?: Snippet;
  }

  let { title, level = 'info', dismissible = false, children }: Props = $props();
</script>

<!--
@component
Alert with a heading, a severity level and optional body content.
-->

<div role="alert" data-level={level}>
  <strong>{title}</strong>
  {@render children?.()}
  {#if dismissible}
    <button type="button" aria-label="Close">×</button>
  {/if}
</div>

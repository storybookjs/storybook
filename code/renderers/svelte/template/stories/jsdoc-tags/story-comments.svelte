<!-- @component A plain component. Its Svelte CSF stories carry the JSDoc tags. -->
<script lang="ts">
  interface Props {
    /** The text. */
    label?: string;
  }

  const { label }: Props = $props();
</script>

<span>{label}</span>

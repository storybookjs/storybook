<!-- @component Use the `@summary` tag. -->
<script lang="ts">
  interface Props {
    /** The text. */
    label?: string;
  }

  const { label }: Props = $props();
</script>

<span>{label}</span>

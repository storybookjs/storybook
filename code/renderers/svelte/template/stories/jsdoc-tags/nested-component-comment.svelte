<script lang="ts">
  interface Props {
    /** The text. */
    label?: string;
  }

  const { label }: Props = $props();
</script>

<div>
  <!--
  @component
  A component comment nested inside an element.
  @summary Nested comment summary
  -->
  <span>{label}</span>
</div>

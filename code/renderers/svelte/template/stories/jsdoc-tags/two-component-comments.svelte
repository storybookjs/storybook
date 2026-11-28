<!--
@component
The first component comment.
@summary First comment summary
-->
<!--
@component
The second component comment.
@summary Second comment summary
-->
<script lang="ts">
  interface Props {
    /** The text. */
    label?: string;
  }

  const { label }: Props = $props();
</script>

<span>{label}</span>

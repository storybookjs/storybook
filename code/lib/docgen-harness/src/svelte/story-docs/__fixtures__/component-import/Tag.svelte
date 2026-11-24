<!--
@component
A small label for a category, such as Design or News.
@summary a small label for a category
@import import Tag from '#lib/repro/Tag.svelte';
-->
<script lang="ts">
  interface Props {
    label: string;
  }

  let { label }: Props = $props();
</script>

<span class="tag">{label}</span>

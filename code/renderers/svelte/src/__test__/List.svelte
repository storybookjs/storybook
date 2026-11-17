<script lang="ts" generics="T">
  interface Props {
    items: T[];
    getLabel: (item: T) => string;
  }
  let { items, getLabel }: Props = $props();
</script>

<ul>
  {#each items as item}
    <li>{getLabel(item)}</li>
  {/each}
</ul>

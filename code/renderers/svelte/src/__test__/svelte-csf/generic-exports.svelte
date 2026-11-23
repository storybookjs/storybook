<script lang="ts" generics="T">
  interface Props {
    items: T[];
  }

  const { items }: Props = $props();

  export function first(): T | undefined {
    return items[0];
  }
</script>

<p>{items.length}</p>

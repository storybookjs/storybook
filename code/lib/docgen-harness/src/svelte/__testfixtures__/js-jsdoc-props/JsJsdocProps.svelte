<script>
  /** @type {{ label: string, count?: number }} */
  let { label, count = 1 } = $props();
</script>

<p>{label} {count}</p>

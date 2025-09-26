<script lang="ts">
  import Button from './Button.svelte';

  let {
    locale,
    label,
  }: {
    locale: string;
    label: string;
  } = $props();
</script>

<div>
  <p>locale: {locale}</p>
  <Button {label} />
</div>

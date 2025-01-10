<script>
  import Button from './Button.svelte';
  
  export let locale;
  export let label;
</script>

<div>
  <p>locale: {locale}</p>
  <Button label={label} />
</div>
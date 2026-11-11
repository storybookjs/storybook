<script module lang="ts">
  import preview from '../preview';

  const { Story } = preview.meta({ render: template });
</script>

{#snippet template(args: { text: string })}
  <p>{args.text}</p>
{/snippet}

<Story name="Text" args={{ text: 'Hello' }} />

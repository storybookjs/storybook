<script module>
  import { defineMeta } from '@storybook/svelte';
  import AliasButton from '$lib/AliasButton.svelte';
  const { Story } = defineMeta({ title: 'Aliases', component: AliasButton });
</script>

<Story name="Default" />

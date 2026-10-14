<script module>
  import { defineMeta } from '@storybook/svelte';
  import Button from '../../__testfixtures__/runes-basic-props/Panel.svelte';
  const { Story } = defineMeta({ title: 'Destructuring', component: Button });
</script>

<Story name="Sibling"><Button label="Sibling" /></Story>
<Story name="Each object">{#each items as { name }}{name}{/each}</Story>
<Story name="Each array">{#each items as [name]}{name}{/each}</Story>
<Story name="Snippet object">{#snippet row({ name })}{name}{/snippet}{@render row({ name: 'Row' })}</Story>
<Story name="Snippet array">{#snippet row([name])}{name}{/snippet}{@render row(['Row'])}</Story>
<Story name="Await object">{#await items then { name }}{name}{/await}</Story>
<Story name="Await array">{#await items then [name]}{name}{/await}</Story>

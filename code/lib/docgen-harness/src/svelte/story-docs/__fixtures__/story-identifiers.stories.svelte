<script module>
  import { defineMeta } from '@storybook/svelte';
  import Button from '../../__testfixtures__/runes-basic-props/Panel.svelte';
  const { Story } = defineMeta({ title: 'Identifiers', component: Button });
</script>

<Story name="Icon before" args={{ label: 'Download' }} />
<Story name="Custom label" exportName="ExplicitExportName" args={{ label: 'Explicit' }} />

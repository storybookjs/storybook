<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Metadata from './Metadata.svelte';
  import data from './data.json';

  const path = '/image.png';
  const makeTab = (label: string) => ({ label });
  const tabs = [makeTab('First'), makeTab('Second')];
  const { Story } = defineMeta({ title: 'Expressions', component: Metadata });
</script>

<Story name="Imported" args={{ data: data.filter((row) => row.enabled) }} />
<Story name="Nested" args={{ value: { path }, tabs }} />
<Story name="Literal" args={{ label: [`Line one\nLine two`] }} />

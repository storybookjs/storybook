<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Panel from './Panel.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/Panel',
    component: Panel,
  });
</script>

<Story name="Default" args={{ label: 'Default label', count: 0, primary: false, title: undefined }} />

<Story name="All Args" exportName="AllArgs" args={{ label: 'All values', count: 3, primary: true, title: 'Panel title' }} />

<Story name="Template Reference" exportName="TemplateReference" args={{ label: 'Reference label', title: 'Reference title' }}>
  {#snippet template(args)}
    <Panel title={args.title}>
      <h1>{args.title}</h1>
      {args.label}
    </Panel>
  {/snippet}
</Story>

<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Card from './Card.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/Card',
    component: Card,
  });
</script>

<Story name="With Content" exportName="WithContent" args={{ title: 'Snippet card' }}>
  {#snippet template(args)}
    <Card {...args}>
      {#snippet header(t)}
        <h2>{t}</h2>
      {/snippet}
      <p>Body</p>
      {#snippet footer()}
        <small>Footer</small>
      {/snippet}
    </Card>
  {/snippet}
</Story>

<Story name="As Child" exportName="AsChild" asChild args={{ title: 'Explicit card' }}>
  <Card title="Explicit card">
    {#snippet footer()}
      <small>Explicit footer</small>
    {/snippet}
  </Card>
</Story>

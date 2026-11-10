<script module lang="ts">
  import preview from './preview.ts';
  import Alert from './Alert.svelte';

  const { Story } = preview.meta({
    title: 'SvelteFixtures/Csf4Alert',
    component: Alert,
  });
</script>

<Story name="Base" args={{ title: 'Base title', level: 'warning' }} />

<!-- Inherits the args of Base. -->
<Story extend="Base" name="Inherited" />

<!-- Overrides one arg of Base. -->
<Story extend="Base" name="Overridden" args={{ level: 'error', dismissible: true }} />

<Story name="Templated" args={{ title: 'Templated title' }}>
  {#snippet template(args)}
    <Alert {...args}>Template body</Alert>
  {/snippet}
</Story>

<!-- Inherits the template of Templated. -->
<Story extend="Templated" name="Templated Child" exportName="TemplatedChild" args={{ level: 'error' }} />

<Story name="Children" args={{ title: 'Children title' }}>Children body</Story>

<!-- Replaces the children of Children. -->
<Story extend="Children" name="Own Children" exportName="OwnChildren">Own body</Story>

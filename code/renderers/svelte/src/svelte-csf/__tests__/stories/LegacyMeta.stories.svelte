<script module>
  import { Meta, Story, Template } from '@storybook/addon-svelte-csf';

  import LegacyMeta from './LegacyMeta.svelte';

  let count = 0;

  function handleClick() {
    count += 1;
  }
</script>

<Meta title="Atoms/Button" component={LegacyMeta} />

<Template let:args>
  <LegacyMeta {...args} on:click={handleClick} on:click>
    You clicked: {count}
  </LegacyMeta>
</Template>

<Story name="Default" />

<Story name="Rounded" args={{ rounded: true }} />

<Story name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story name="No Args">
  <LegacyMeta>Label</LegacyMeta>
</Story>
